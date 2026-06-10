/**
 * Transaction Logging Utilities
 * Comprehensive logging untuk debugging dan audit trail
 */

const fs = require('fs');
const path = require('path');

/**
 * ==========================================
 * TRANSACTION LOGGER
 * ==========================================
 * Production-ready logging untuk payment transactions
 */
class TransactionLogger {
  constructor(logDir = './logs') {
    this.logDir = logDir;
    this.createLogDirectory();
    this.logLevel = process.env.LOG_LEVEL || 'info'; // debug, info, warn, error
  }

  /**
   * Create log directory jika tidak ada
   * @private
   */
  createLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.error('[LOGGER] Failed to create log directory:', error);
    }
  }

  /**
   * Get log file path untuk date-based rotation
   * @private
   */
  getLogFilePath(logType = 'transactions') {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `${logType}-${date}.log`;
    return path.join(this.logDir, filename);
  }

  /**
   * Format log entry dengan timestamp dan level
   * @private
   */
  formatLogEntry(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level,
      message,
      data,
      pid: process.pid,
      memory: process.memoryUsage().heapUsed / 1024 / 1024
    };
    return JSON.stringify(entry);
  }

  /**
   * Write log ke file
   * @private
   */
  writeLog(logType, level, message, data) {
    try {
      const logFile = this.getLogFilePath(logType);
      const logEntry = this.formatLogEntry(level, message, data);
      fs.appendFileSync(logFile, logEntry + '\n', 'utf8');
    } catch (error) {
      console.error('[LOGGER] Failed to write log:', error);
    }
  }

  /**
   * Log payment transaction creation
   * @param {String} orderId - Order ID
   * @param {Object} data - Payment data
   */
  logTransactionCreated(orderId, data) {
    const message = 'Payment transaction created';
    const logData = {
      orderId,
      amount: data.amount,
      paymentMethod: data.payment_method,
      customer: {
        email: data.customerEmail,
        phone: data.customerPhone
      },
      ipAddress: data.ip_address,
      userAgent: data.user_agent
    };

    this.writeLog('transactions', 'info', message, logData);
    console.log(`[PAYMENT] ${message}:`, logData);
  }

  /**
   * Log webhook received
   * @param {Object} webhookData - Webhook data
   * @param {String} ipAddress - Webhook sender IP
   */
  logWebhookReceived(webhookData, ipAddress) {
    const message = 'Webhook received from Midtrans';
    const logData = {
      webhookId: webhookData.id,
      transactionId: webhookData.transaction_id,
      orderId: webhookData.order_id,
      status: webhookData.transaction_status,
      amount: webhookData.gross_amount,
      ipAddress,
      timestamp: webhookData.transaction_time
    };

    this.writeLog('webhooks', 'info', message, logData);
    console.log(`[WEBHOOK] ${message}:`, logData);
  }

  /**
   * Log webhook verification
   * @param {String} webhookId - Webhook ID
   * @param {Boolean} signatureValid - Signature valid status
   * @param {Boolean} timestampValid - Timestamp valid status
   * @param {Boolean} ipValid - IP valid status
   * @param {String} ipAddress - Sender IP
   */
  logWebhookVerification(webhookId, signatureValid, timestampValid, ipValid, ipAddress) {
    const message = 'Webhook verification result';
    const logData = {
      webhookId,
      signatureValid,
      timestampValid,
      ipValid,
      ipAddress,
      allValid: signatureValid && timestampValid && ipValid
    };

    const level = (signatureValid && timestampValid && ipValid) ? 'info' : 'warn';
    this.writeLog('webhooks', level, message, logData);
    
    if (level === 'warn') {
      console.warn(`[WEBHOOK-SECURITY] ${message}:`, logData);
    }
  }

  /**
   * Log payment status update
   * @param {String} orderId - Order ID
   * @param {String} oldStatus - Old payment status
   * @param {String} newStatus - New payment status
   * @param {Object} details - Additional details
   */
  logPaymentStatusUpdate(orderId, oldStatus, newStatus, details = {}) {
    const message = `Payment status updated: ${oldStatus} → ${newStatus}`;
    const logData = {
      orderId,
      oldStatus,
      newStatus,
      ...details
    };

    this.writeLog('transactions', 'info', message, logData);
    console.log(`[PAYMENT] ${message}:`, logData);
  }

  /**
   * Log payment settlement
   * @param {String} transactionId - Transaction ID
   * @param {Number} amount - Settlement amount
   * @param {String} status - Settlement status
   */
  logSettlement(transactionId, amount, status) {
    const message = 'Payment settlement processed';
    const logData = {
      transactionId,
      amount,
      status,
      settlementTime: new Date().toISOString()
    };

    this.writeLog('settlement', 'info', message, logData);
    console.log(`[SETTLEMENT] ${message}:`, logData);
  }

  /**
   * Log failed payment
   * @param {String} orderId - Order ID
   * @param {String} reason - Failure reason
   * @param {Object} details - Error details
   */
  logPaymentFailed(orderId, reason, details = {}) {
    const message = `Payment failed: ${reason}`;
    const logData = {
      orderId,
      reason,
      ...details
    };

    this.writeLog('transactions', 'error', message, logData);
    console.error(`[PAYMENT-ERROR] ${message}:`, logData);
  }

  /**
   * Log fraud detection
   * @param {String} orderId - Order ID
   * @param {String} fraudIndicator - Type of fraud
   * @param {Number} score - Fraud score (0-100)
   * @param {Object} details - Details
   */
  logFraudDetected(orderId, fraudIndicator, score, details = {}) {
    const message = `Fraud detected: ${fraudIndicator} (score: ${score})`;
    const logData = {
      orderId,
      fraudIndicator,
      score,
      ...details
    };

    this.writeLog('fraud', 'warn', message, logData);
    console.warn(`[FRAUD-DETECTION] ${message}:`, logData);
  }

  /**
   * Log payment retry attempt
   * @param {String} orderId - Order ID
   * @param {Number} attemptNumber - Current attempt number
   * @param {Number} maxAttempts - Max attempts
   * @param {String} reason - Retry reason
   */
  logPaymentRetry(orderId, attemptNumber, maxAttempts, reason) {
    const message = `Payment retry attempt ${attemptNumber}/${maxAttempts}: ${reason}`;
    const logData = {
      orderId,
      attemptNumber,
      maxAttempts,
      reason
    };

    this.writeLog('retry', 'info', message, logData);
    console.log(`[PAYMENT-RETRY] ${message}:`, logData);
  }

  /**
   * Log refund request
   * @param {String} transactionId - Transaction ID
   * @param {Number} amount - Refund amount
   * @param {String} reason - Refund reason
   * @param {String} requestedBy - Who requested
   */
  logRefundRequest(transactionId, amount, reason, requestedBy) {
    const message = 'Refund request created';
    const logData = {
      transactionId,
      amount,
      reason,
      requestedBy
    };

    this.writeLog('refunds', 'info', message, logData);
    console.log(`[REFUND] ${message}:`, logData);
  }

  /**
   * Log API error
   * @param {String} endpoint - API endpoint
   * @param {String} method - HTTP method
   * @param {Number} statusCode - HTTP status
   * @param {String} errorMessage - Error message
   * @param {Object} details - Additional details
   */
  logApiError(endpoint, method, statusCode, errorMessage, details = {}) {
    const message = `API Error: ${method} ${endpoint} - ${statusCode}`;
    const logData = {
      endpoint,
      method,
      statusCode,
      errorMessage,
      ...details
    };

    this.writeLog('errors', 'error', message, logData);
    console.error(`[API-ERROR] ${message}:`, logData);
  }

  /**
   * Log database error
   * @param {String} operation - DB operation (INSERT, UPDATE, SELECT, etc)
   * @param {String} table - Database table
   * @param {String} errorMessage - Error message
   * @param {Object} details - SQL details
   */
  logDatabaseError(operation, table, errorMessage, details = {}) {
    const message = `Database Error: ${operation} on ${table}`;
    const logData = {
      operation,
      table,
      errorMessage,
      ...details
    };

    this.writeLog('database', 'error', message, logData);
    console.error(`[DB-ERROR] ${message}:`, logData);
  }

  /**
   * Generate daily report
   * @param {String} date - Date (YYYY-MM-DD) atau 'today'
   */
  generateDailyReport(date = 'today') {
    try {
      const targetDate = date === 'today' ? new Date().toISOString().split('T')[0] : date;
      const logFile = path.join(this.logDir, `transactions-${targetDate}.log`);

      if (!fs.existsSync(logFile)) {
        return null;
      }

      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      const report = {
        date: targetDate,
        totalEvents: lines.length,
        summary: {
          created: 0,
          settled: 0,
          failed: 0,
          pending: 0
        },
        events: []
      };

      lines.forEach(line => {
        try {
          const entry = JSON.parse(line);
          report.events.push(entry);

          if (entry.message.includes('created')) report.summary.created++;
          if (entry.message.includes('settlement')) report.summary.settled++;
          if (entry.message.includes('failed')) report.summary.failed++;
          if (entry.message.includes('pending')) report.summary.pending++;
        } catch (e) {
          // Skip invalid JSON lines
        }
      });

      return report;
    } catch (error) {
      console.error('[LOGGER] Generate report error:', error);
      return null;
    }
  }

  /**
   * Rotate old log files (cleanup)
   * @param {Number} daysToKeep - Keep logs dari N hari terakhir (default: 30)
   */
  rotateLogs(daysToKeep = 30) {
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      files.forEach(file => {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          console.log(`[LOGGER] Deleted old log file: ${file}`);
        }
      });
    } catch (error) {
      console.error('[LOGGER] Log rotation error:', error);
    }
  }
}

/**
 * ==========================================
 * EXPORT
 * ==========================================
 */
module.exports = TransactionLogger;
