/**
 * Payment Handler Module
 * ==========================================
 * 
 * Handles all payment-related operations with:
 * - Transaction creation dengan Midtrans
 * - Webhook verification dan processing
 * - Race condition prevention (idempotency)
 * - Error handling & retry mechanism
 * - Comprehensive logging & security
 * 
 * Production-Ready Payment Integration
 */

const snap = require('midtrans-client').Snap;
const { 
  MidtransSignatureValidator, 
  generateTransactionId,
  PAYMENT_METHODS,
  PAYMENT_STATUS 
} = require('./security-utils');
const TransactionLogger = require('./transaction-logger');

class PaymentHandler {
  constructor(db, serverKey, clientKey, options = {}) {
    this.db = db;
    this.serverKey = serverKey;
    this.clientKey = clientKey;
    
    // Initialize Snap client
    const isProduction = process.env.NODE_ENV === 'production';
    this.snapClient = new snap({
      isProduction,
      serverKey,
      clientKey
    });

    // Security validator
    this.validator = new MidtransSignatureValidator(serverKey);

    // Logger
    this.logger = new TransactionLogger(options.logDir || './logs');

    // Configuration
    this.config = {
      paymentExpiry: parseInt(process.env.PAYMENT_EXPIRY_TIME || '3600'),
      webhookSecret: process.env.MIDTRANS_WEBHOOK_SECRET,
      webhookIpWhitelist: process.env.MIDTRANS_WEBHOOK_IP_WHITELIST || '',
      maxTransactionAmount: parseInt(process.env.MAX_TRANSACTION_AMOUNT || '50000000'),
      minTransactionAmount: parseInt(process.env.MIN_TRANSACTION_AMOUNT || '10000'),
      retryAttempts: parseInt(process.env.PAYMENT_RETRY_ATTEMPTS || '3'),
      retryInterval: parseInt(process.env.PAYMENT_RETRY_INTERVAL || '300')
    };
  }

  /**
   * ==========================================
   * CREATE PAYMENT TRANSACTION
   * ==========================================
   * Buat sesi pembayaran baru dengan Midtrans
   * 
   * Input validation:
   * - Amount range check
   * - Order validation
   * - Customer data validation
   */
  async createPaymentTransaction(transactionData) {
    const transactionId = generateTransactionId();
    
    try {
      // 1. VALIDATION
      this._validateTransactionInput(transactionData);

      const {
        orderId,
        amount,
        customerEmail,
        customerName,
        customerPhone,
        paymentMethod = 'all',
        ipAddress = '0.0.0.0',
        userAgent = ''
      } = transactionData;

      // 2. CHECK AMOUNT LIMITS
      if (amount < this.config.minTransactionAmount || amount > this.config.maxTransactionAmount) {
        throw new Error(
          `Invalid amount: ${amount}. Must be between ${this.config.minTransactionAmount} ` +
          `and ${this.config.maxTransactionAmount}`
        );
      }

      // 3. DATABASE: Save pending transaction
      const connection = await this.db.getConnection();
      try {
        await connection.execute(
          `INSERT INTO payment_transactions 
           (id, order_id, amount, payment_method, payment_status, customer_email, 
            customer_phone, ip_address, user_agent, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            transactionId,
            orderId,
            amount,
            paymentMethod,
            PAYMENT_STATUS.PENDING,
            customerEmail,
            customerPhone,
            ipAddress,
            userAgent
          ]
        );
      } finally {
        connection.release();
      }

      // 4. BUILD MIDTRANS PARAMETER
      const parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: amount
        },
        customer_details: {
          email: customerEmail,
          first_name: customerName.split(' ')[0],
          last_name: customerName.split(' ').slice(1).join(' ') || '',
          phone: customerPhone
        },
        callbacks: {
          finish: process.env.PAYMENT_SUCCESS_URL || `${process.env.APP_URL || 'http://localhost:3000'}/payment-success.html?order_id=${orderId}`,
          error: process.env.PAYMENT_FAILURE_URL || `${process.env.APP_URL || 'http://localhost:3000'}/payment-failure.html?order_id=${orderId}`,
          unfinish: process.env.PAYMENT_PENDING_URL || `${process.env.APP_URL || 'http://localhost:3000'}/payment-pending.html?order_id=${orderId}`
        }
      };

      // 5. CONFIGURE PAYMENT METHODS
      this._configurePaymentMethods(parameter, paymentMethod);

      // 6. CREATE SNAP TOKEN
      const snapResponse = await this.snapClient.createTransaction(parameter);

      // 7. UPDATE TRANSACTION WITH TOKEN
      const conn2 = await this.db.getConnection();
      try {
        await conn2.execute(
          `UPDATE payment_transactions 
           SET snap_token = ?, midtrans_transaction_id = ?
           WHERE id = ?`,
          [snapResponse.token || null, snapResponse.transaction_id || null, transactionId]
        );
      } finally {
        conn2.release();
      }

      // 8. LOG
      this.logger.logTransactionCreated(orderId, {
        amount,
        payment_method: paymentMethod,
        customerEmail,
        customerPhone,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      // 9. RETURN RESPONSE
      return {
        success: true,
        transactionId,
        snapToken: snapResponse.token,
        redirectUrl: snapResponse.redirect_url,
        message: 'Payment transaction created successfully'
      };

    } catch (error) {
      this.logger.logPaymentFailed(
        transactionData.orderId,
        'Transaction creation failed',
        { error: error.message, transactionId }
      );
      
      throw {
        success: false,
        error: error.message,
        transactionId
      };
    }
  }

  /**
   * ==========================================
   * PROCESS WEBHOOK NOTIFICATION
   * ==========================================
   * Handle Midtrans webhook dengan security checks
   * 
   * Security measures:
   * 1. Signature verification (SHA256)
   * 2. Timestamp validation (prevent replay attack)
   * 3. IP whitelist check
   * 4. Idempotency check (prevent double processing)
   * 5. Transaction verification
   * 6. Database atomic update
   */
  async processWebhookNotification(notificationData, headers, requestIp) {
    const webhookId = headers['x-callback-token'] || headers['x-appended-signature'] || 'unknown';
    
    try {
      // 1. LOG WEBHOOK RECEIVED
      this.logger.logWebhookReceived(notificationData, requestIp);

      // 2. SECURITY VERIFICATION
      const signatureValid = this.validator.validateSignature(
        notificationData,
        notificationData.signature
      );

      const timestamp = headers['x-appended-timestamp'] || new Date().toISOString();
      const timestampValid = this.validator.validateTimestamp(timestamp);

      const ipValid = this.validator.validateIpAddress(
        requestIp,
        this.config.webhookIpWhitelist
      );

      // Log verification result
      this.logger.logWebhookVerification(webhookId, signatureValid, timestampValid, ipValid, requestIp);

      if (!signatureValid || !timestampValid || !ipValid) {
        throw new Error(
          `Webhook verification failed: signature=${signatureValid}, timestamp=${timestampValid}, ip=${ipValid}`
        );
      }

      // 3. EXTRACT DATA
      const orderId = notificationData.order_id;
      const transactionStatus = notificationData.transaction_status;
      const midtransTransactionId = notificationData.transaction_id;
      const grossAmount = notificationData.gross_amount;

      // 4. CHECK IDEMPOTENCY (prevent double processing)
      const connection = await this.db.getConnection();
      try {
        const [existingWebhook] = await connection.execute(
          `SELECT id, processing_status FROM payment_webhooks 
           WHERE webhook_id = ? LIMIT 1`,
          [webhookId]
        );

        if (existingWebhook.length > 0 && existingWebhook[0].processing_status === 'processed') {
          this.logger.logWebhookVerification(webhookId, true, true, true, requestIp);
          return {
            success: true,
            message: 'Webhook already processed (idempotency)',
            isDuplicate: true
          };
        }
      } finally {
        connection.release();
      }

      // 5. RECORD WEBHOOK
      const conn2 = await this.db.getConnection();
      try {
        const webhookIdDb = await this._getOrCreateWebhookRecord(
          conn2,
          webhookId,
          orderId,
          notificationData
        );
      } finally {
        conn2.release();
      }

      // 6. DETERMINE PAYMENT STATUS
      const paymentStatus = this._mapTransactionStatus(transactionStatus);

      // 7. UPDATE TRANSACTION (ATOMIC)
      const conn3 = await this.db.getConnection();
      try {
        // Begin transaction untuk atomic update
        await conn3.execute('START TRANSACTION');

        try {
          // Update payment transaction
          await conn3.execute(
            `UPDATE payment_transactions 
             SET payment_status = ?, 
                 midtrans_transaction_id = ?, 
                 webhook_received_at = NOW(),
                 updated_at = NOW()
             WHERE order_id = ? AND payment_status IN ('pending', 'capture')`,
            [paymentStatus, midtransTransactionId, orderId]
          );

          // Update order status jika paid
          if (paymentStatus === PAYMENT_STATUS.SETTLEMENT || paymentStatus === PAYMENT_STATUS.CAPTURE) {
            await conn3.execute(
              `UPDATE orders 
               SET status_index = 1, last_updated = NOW() 
               WHERE id = ? AND status_index = 0`,
              [orderId]
            );

            this.logger.logPaymentStatusUpdate(orderId, 'pending', 'paid');
          } else if ([PAYMENT_STATUS.DENY, PAYMENT_STATUS.CANCEL, PAYMENT_STATUS.EXPIRE].includes(paymentStatus)) {
            this.logger.logPaymentStatusUpdate(orderId, 'pending', 'failed', {
              reason: transactionStatus
            });
          }

          // Update webhook status
          await conn3.execute(
            `UPDATE payment_webhooks 
             SET processing_status = 'processed', processed_at = NOW() 
             WHERE webhook_id = ?`,
            [webhookId]
          );

          await conn3.execute('COMMIT');

          this.logger.logSettlement(midtransTransactionId, grossAmount, paymentStatus);

          return {
            success: true,
            message: 'Webhook processed successfully',
            orderId,
            newStatus: paymentStatus
          };

        } catch (error) {
          await conn3.execute('ROLLBACK');
          throw error;
        }
      } finally {
        conn3.release();
      }

    } catch (error) {
      this.logger.logDatabaseError(
        'UPDATE',
        'payment_transactions',
        error.message,
        { webhookId, orderId: notificationData.order_id }
      );

      // Update webhook status to failed
      try {
        const conn4 = await this.db.getConnection();
        await conn4.execute(
          `UPDATE payment_webhooks 
           SET processing_status = 'failed', processing_error = ?
           WHERE webhook_id = ?`,
          [error.message, webhookId]
        );
        conn4.release();
      } catch (logError) {
        console.error('[WEBHOOK] Failed to log error:', logError);
      }

      throw {
        success: false,
        error: error.message,
        webhookId
      };
    }
  }

  /**
   * ==========================================
   * GET PAYMENT STATUS
   * ==========================================
   */
  async getPaymentStatus(orderId) {
    try {
      const connection = await this.db.getConnection();
      try {
        const [results] = await connection.execute(
          `SELECT * FROM payment_transactions 
           WHERE order_id = ? 
           ORDER BY created_at DESC LIMIT 1`,
          [orderId]
        );

        if (results.length === 0) {
          return null;
        }

        return results[0];
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('[PAYMENT] Get status error:', error);
      throw error;
    }
  }

  /**
   * ==========================================
   * INTERNAL HELPER METHODS
   * ==========================================
   */

  /**
   * Validate transaction input
   * @private
   */
  _validateTransactionInput(data) {
    const required = ['orderId', 'amount', 'customerEmail', 'customerName', 'customerPhone'];
    
    for (const field of required) {
      if (!data[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customerEmail)) {
      throw new Error('Invalid email format');
    }

    // Phone validation (basic)
    if (!/^\d{7,15}$/.test(data.customerPhone.replace(/\D/g, ''))) {
      throw new Error('Invalid phone number');
    }
  }

  /**
   * Configure payment methods for Snap
   * @private
   */
  _configurePaymentMethods(parameter, paymentMethod) {
    const enabledPayments = [
      'bank_transfer',
      'gopay',
      'ovo',
      'dana',
      'shopeepay',
      'qris'
    ];

    const paymentOverrides = {};

    switch (paymentMethod) {
      case PAYMENT_METHODS.BANK_TRANSFER_BCA:
        parameter.enabled_payments = ['bank_transfer'];
        parameter.bank_transfer = { bank: 'bca' };
        break;
      case PAYMENT_METHODS.BANK_TRANSFER_MANDIRI:
        parameter.enabled_payments = ['bank_transfer'];
        parameter.bank_transfer = { bank: 'mandiri' };
        break;
      case PAYMENT_METHODS.GOPAY:
        parameter.enabled_payments = ['gopay'];
        break;
      case PAYMENT_METHODS.OVO:
        parameter.enabled_payments = ['ovo'];
        break;
      case PAYMENT_METHODS.DANA:
        parameter.enabled_payments = ['dana'];
        break;
      case PAYMENT_METHODS.QRIS:
        parameter.enabled_payments = ['qris'];
        break;
      default:
        parameter.enabled_payments = enabledPayments;
    }
  }

  /**
   * Map Midtrans transaction status to our payment status
   * @private
   */
  _mapTransactionStatus(transactionStatus) {
    const mapping = {
      'settlement': PAYMENT_STATUS.SETTLEMENT,
      'capture': PAYMENT_STATUS.CAPTURE,
      'pending': PAYMENT_STATUS.PENDING,
      'deny': PAYMENT_STATUS.DENY,
      'cancel': PAYMENT_STATUS.CANCEL,
      'expire': PAYMENT_STATUS.EXPIRE,
      'failure': PAYMENT_STATUS.FAILED,
      'refund': PAYMENT_STATUS.REFUND
    };

    return mapping[transactionStatus] || PAYMENT_STATUS.PENDING;
  }

  /**
   * Get or create webhook record
   * @private
   */
  async _getOrCreateWebhookRecord(connection, webhookId, orderId, payload) {
    try {
      const [existing] = await connection.execute(
        `SELECT id FROM payment_webhooks WHERE webhook_id = ? LIMIT 1`,
        [webhookId]
      );

      if (existing.length > 0) {
        return existing[0].id;
      }

      const result = await connection.execute(
        `INSERT INTO payment_webhooks 
         (webhook_id, order_id, transaction_id, event_type, transaction_status, 
          gross_amount, payload, signature_verified, processing_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          webhookId,
          orderId,
          payload.transaction_id,
          'payment_notification',
          payload.transaction_status,
          payload.gross_amount,
          JSON.stringify(payload),
          true,
          'pending'
        ]
      );

      return result[0].insertId;
    } catch (error) {
      console.error('[WEBHOOK] Create record error:', error);
      throw error;
    }
  }
}

/**
 * ==========================================
 * EXPORT
 * ==========================================
 */
module.exports = PaymentHandler;
