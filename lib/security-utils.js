/**
 * Security Utilities for Payment Integration
 * - Signature verification untuk Midtrans webhook
 * - Encryption untuk data sensitif
 * - Rate limiting untuk API protection
 */

const crypto = require('crypto');

/**
 * ==========================================
 * MIDTRANS WEBHOOK SIGNATURE VERIFICATION
 * ==========================================
 * Memverifikasi bahwa webhook benar-benar dari Midtrans, bukan attacker
 * 
 * Signature Validation:
 * SHA256(order_id + status_code + gross_amount + ServerKey) === received_signature
 */
class MidtransSignatureValidator {
  constructor(serverKey) {
    if (!serverKey || serverKey === 'YOUR_SERVER_KEY') {
      throw new Error('Midtrans Server Key tidak dikonfigurasi. Set MIDTRANS_SERVER_KEY di .env');
    }
    this.serverKey = serverKey;
  }

  /**
   * Validasi signature dari webhook Midtrans
   * @param {Object} notification - Data dari webhook
   * @param {String} signature - Signature header dari Midtrans
   * @returns {Boolean} true jika valid, false jika invalid
   */
  validateSignature(notification, signature) {
    try {
      // Midtrans signature formula:
      // SHA256(order_id + status_code + gross_amount + ServerKey)
      const orderId = notification.order_id || '';
      const statusCode = notification.status_code || '';
      const grossAmount = notification.gross_amount || '';

      const signatureString = `${orderId}${statusCode}${grossAmount}${this.serverKey}`;
      const calculatedSignature = crypto
        .createHash('sha256')
        .update(signatureString)
        .digest('hex');

      const isValid = calculatedSignature === signature;

      if (!isValid) {
        console.error('[SECURITY] Signature mismatch!', {
          received: signature,
          calculated: calculatedSignature,
          orderId,
          statusCode,
          grossAmount
        });
      }

      return isValid;
    } catch (error) {
      console.error('[SECURITY] Signature validation error:', error);
      return false;
    }
  }

  /**
   * Validasi webhook timestamp (prevent replay attack)
   * @param {String} timestamp - Timestamp dari header X-Appended-Timestamp
   * @param {Number} maxAgeSeconds - Max age dalam seconds (default: 300 = 5 menit)
   * @returns {Boolean}
   */
  validateTimestamp(timestamp, maxAgeSeconds = 300) {
    try {
      const webhookTime = new Date(timestamp).getTime();
      const currentTime = new Date().getTime();
      const timeDifference = Math.abs(currentTime - webhookTime) / 1000; // convert to seconds

      const isValid = timeDifference <= maxAgeSeconds;

      if (!isValid) {
        console.error('[SECURITY] Timestamp too old (possible replay attack)', {
          webhook_time: timestamp,
          time_difference_seconds: timeDifference,
          max_age_seconds: maxAgeSeconds
        });
      }

      return isValid;
    } catch (error) {
      console.error('[SECURITY] Timestamp validation error:', error);
      return false;
    }
  }

  /**
   * Validasi IP address dari webhook sender
   * @param {String} remoteIp - IP address dari request
   * @param {String} whitelist - Comma-separated IP list atau CIDR
   * @returns {Boolean}
   */
  validateIpAddress(remoteIp, whitelist) {
    if (!whitelist || whitelist.trim() === '') {
      // Development: skip IP validation
      return true;
    }

    try {
      const allowedIps = whitelist.split(',').map(ip => ip.trim());

      // For production, add Midtrans IP ranges:
      // 103.153.122.0/24, 103.231.84.0/24, 103.46.137.0/24, 202.43.172.0/24
      const midtransIps = [
        '103.153.122.0/24',
        '103.231.84.0/24',
        '103.46.137.0/24',
        '202.43.172.0/24'
      ];

      // Check if remoteIp matches any allowed IP or CIDR
      for (const allowedIp of allowedIps.concat(midtransIps)) {
        if (this._isIpInRange(remoteIp, allowedIp)) {
          return true;
        }
      }

      console.error('[SECURITY] IP address not whitelisted', {
        remote_ip: remoteIp,
        allowed_ips: allowedIps
      });

      return false;
    } catch (error) {
      console.error('[SECURITY] IP validation error:', error);
      return false;
    }
  }

  /**
   * Helper: Check if IP matches CIDR range
   * @private
   */
  _isIpInRange(ip, range) {
    if (!range.includes('/')) {
      // Single IP
      return ip === range;
    }

    // CIDR notation
    try {
      const [network, bits] = range.split('/');
      const networkParts = network.split('.');
      const ipParts = ip.split('.');

      if (networkParts.length !== 4 || ipParts.length !== 4) {
        return false;
      }

      const networkInt = this._ipToInt(networkParts.map(Number));
      const ipInt = this._ipToInt(ipParts.map(Number));
      const mask = -1 << (32 - parseInt(bits, 10));

      return (networkInt & mask) === (ipInt & mask);
    } catch (error) {
      console.error('[SECURITY] CIDR parsing error:', error);
      return false;
    }
  }

  /**
   * Helper: Convert IP parts to integer
   * @private
   */
  _ipToInt(parts) {
    return parts[0] * 16777216 + parts[1] * 65536 + parts[2] * 256 + parts[3];
  }
}

/**
 * ==========================================
 * DATA ENCRYPTION UTILITIES (Optional)
 * ==========================================
 * Untuk encrypt/decrypt data sensitif seperti card tokens
 */
class DataEncryption {
  constructor(encryptionKey) {
    if (!encryptionKey || encryptionKey.length < 32) {
      throw new Error('Encryption key must be at least 32 characters (preferably hex 32 bytes)');
    }
    // Convert hex string ke Buffer jika diperlukan
    this.key = Buffer.isBuffer(encryptionKey) 
      ? encryptionKey 
      : Buffer.from(encryptionKey, 'hex');
  }

  /**
   * Encrypt sensitive data
   * @param {String} plaintext - Data yang akan diencrypt
   * @returns {String} Encrypted data (hex format)
   */
  encrypt(plaintext) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', this.key, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Return iv + encrypted (iv diperlukan untuk decrypt)
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('[ENCRYPTION] Encrypt error:', error);
      throw error;
    }
  }

  /**
   * Decrypt encrypted data
   * @param {String} ciphertext - Encrypted data (hex format)
   * @returns {String} Original plaintext
   */
  decrypt(ciphertext) {
    try {
      const parts = ciphertext.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid ciphertext format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, iv);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('[ENCRYPTION] Decrypt error:', error);
      throw error;
    }
  }

  /**
   * Hash password/sensitive string (one-way)
   * @param {String} data - Data yang akan di-hash
   * @param {String} salt - Optional salt (akan generate random jika tidak ada)
   * @returns {String} Hashed data
   */
  hashPassword(data, salt = null) {
    try {
      const saltUsed = salt || crypto.randomBytes(32).toString('hex');
      const hash = crypto.pbkdf2Sync(data, saltUsed, 100000, 64, 'sha512');
      return `${saltUsed}:${hash.toString('hex')}`;
    } catch (error) {
      console.error('[ENCRYPTION] Hash error:', error);
      throw error;
    }
  }

  /**
   * Verify hashed password
   * @param {String} data - Original data
   * @param {String} hash - Hashed data (dari hashPassword)
   * @returns {Boolean}
   */
  verifyPassword(data, hash) {
    try {
      const [salt, storedHash] = hash.split(':');
      const recomputed = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512');
      return recomputed.toString('hex') === storedHash;
    } catch (error) {
      console.error('[ENCRYPTION] Verify error:', error);
      return false;
    }
  }
}

/**
 * ==========================================
 * RATE LIMITING
 * ==========================================
 * Prevent brute force attacks dan DDoS
 */
class RateLimiter {
  constructor() {
    this.store = new Map(); // In-production, gunakan Redis
  }

  /**
   * Check rate limit untuk IP/user
   * @param {String} identifier - IP address atau user ID
   * @param {Number} maxRequests - Max requests per window
   * @param {Number} windowSeconds - Time window dalam seconds
   * @returns {Object} {allowed: Boolean, remaining: Number, resetIn: Number}
   */
  checkLimit(identifier, maxRequests = 100, windowSeconds = 60) {
    try {
      const now = Date.now();
      const key = `limit:${identifier}`;

      let record = this.store.get(key);

      if (!record) {
        // First request
        this.store.set(key, {
          count: 1,
          startTime: now,
          resetAt: now + windowSeconds * 1000
        });
        return {
          allowed: true,
          remaining: maxRequests - 1,
          resetIn: windowSeconds
        };
      }

      const elapsed = now - record.startTime;
      const isWindowExpired = elapsed > windowSeconds * 1000;

      if (isWindowExpired) {
        // Reset window
        record = {
          count: 1,
          startTime: now,
          resetAt: now + windowSeconds * 1000
        };
        this.store.set(key, record);
        return {
          allowed: true,
          remaining: maxRequests - 1,
          resetIn: windowSeconds
        };
      }

      // Still in window
      const allowed = record.count < maxRequests;
      record.count++;

      const resetIn = Math.ceil((record.resetAt - now) / 1000);

      return {
        allowed,
        remaining: Math.max(0, maxRequests - record.count),
        resetIn
      };
    } catch (error) {
      console.error('[RATE_LIMIT] Error:', error);
      return { allowed: true, remaining: -1, resetIn: 0 }; // Fail open
    }
  }

  /**
   * Clean up expired entries (call periodically)
   */
  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * ==========================================
 * IDEMPOTENCY KEY VALIDATION
 * ==========================================
 * Prevent double-submission (race condition prevention)
 */
class IdempotencyValidator {
  constructor() {
    this.processedKeys = new Map();
  }

  /**
   * Check if idempotency key already processed
   * @param {String} key - Unique idempotency key
   * @param {Number} ttlSeconds - How long to keep record (default: 3600 = 1 hour)
   * @returns {Object} {isProcessed: Boolean, result: Object|null}
   */
  checkKey(key, ttlSeconds = 3600) {
    try {
      const now = Date.now();
      const record = this.processedKeys.get(key);

      if (!record) {
        // First time seeing this key
        this.processedKeys.set(key, {
          createdAt: now,
          result: null,
          status: 'processing',
          expiresAt: now + ttlSeconds * 1000
        });
        return { isProcessed: false, result: null };
      }

      // Key sudah ada
      if (now > record.expiresAt) {
        // TTL expired, treat as new request
        record.createdAt = now;
        record.status = 'processing';
        record.result = null;
        record.expiresAt = now + ttlSeconds * 1000;
        return { isProcessed: false, result: null };
      }

      if (record.status === 'completed') {
        return { isProcessed: true, result: record.result };
      }

      // Still processing
      return { isProcessed: false, result: null };
    } catch (error) {
      console.error('[IDEMPOTENCY] Error:', error);
      return { isProcessed: false, result: null };
    }
  }

  /**
   * Mark key sebagai selesai dengan result
   * @param {String} key - Idempotency key
   * @param {Object} result - Result data
   */
  markComplete(key, result) {
    try {
      const record = this.processedKeys.get(key);
      if (record) {
        record.status = 'completed';
        record.result = result;
      }
    } catch (error) {
      console.error('[IDEMPOTENCY] Mark complete error:', error);
    }
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.processedKeys.entries()) {
      if (now > record.expiresAt) {
        this.processedKeys.delete(key);
      }
    }
  }
}

/**
 * ==========================================
 * EXPORT
 * ==========================================
 */
module.exports = {
  MidtransSignatureValidator,
  DataEncryption,
  RateLimiter,
  IdempotencyValidator,

  // Helper functions
  generateTransactionId: () => `TRX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  generateWebhookSecret: () => crypto.randomBytes(32).toString('base64'),
  
  // Constants
  PAYMENT_METHODS: {
    BANK_TRANSFER_BCA: 'bank_transfer_bca',
    BANK_TRANSFER_MANDIRI: 'bank_transfer_mandiri',
    GOPAY: 'gopay',
    OVO: 'ovo',
    DANA: 'dana',
    QRIS: 'qris',
    SHOPEEPAY: 'shopeepay'
  },

  PAYMENT_STATUS: {
    PENDING: 'pending',
    CAPTURE: 'capture',
    SETTLEMENT: 'settlement',
    DENY: 'deny',
    CANCEL: 'cancel',
    EXPIRE: 'expire',
    FAILED: 'failed',
    REFUND: 'refund'
  }
};
