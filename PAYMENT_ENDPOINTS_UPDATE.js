/**
 * PAYMENT INTEGRATION UPDATE FOR SERVER.JS
 * ==========================================
 * 
 * This file shows the NEW PAYMENT ENDPOINTS and MODULE INITIALIZATION
 * to add to your existing server.js
 * 
 * Copy the relevant sections and integrate with your existing server.js
 */

// ==========================================
// ADD THIS AFTER DATABASE SETUP (around line 100)
// ==========================================

// Initialize security utilities
const logger = new TransactionLogger(process.env.LOG_DIR || './logs');
const rateLimiter = new RateLimiter();
const idempotencyValidator = new IdempotencyValidator();

// Initialize Payment Handler dengan database pool
const paymentHandler = new PaymentHandler(
  pool,
  process.env.NODE_ENV === 'production'
    ? process.env.MIDTRANS_SERVER_KEY
    : process.env.MIDTRANS_SANDBOX_SERVER_KEY,
  process.env.NODE_ENV === 'production'
    ? process.env.MIDTRANS_CLIENT_KEY
    : process.env.MIDTRANS_SANDBOX_CLIENT_KEY,
  { logDir: process.env.LOG_DIR || './logs' }
);

// ==========================================
// MIDDLEWARE: Capture request IP dan User-Agent
// ==========================================

app.use((req, res, next) => {
  // Capture client IP address
  req.clientIp = req.headers['x-forwarded-for']?.split(',')[0]
    || req.headers['x-real-ip']
    || req.connection.remoteAddress
    || '0.0.0.0';
  
  req.userAgent = req.headers['user-agent'] || '';
  next();
});

// ==========================================
// REPLACE: /api/payment/create-token ENDPOINT
// ==========================================
// LOCATION: Replace from line ~349 (app.post('/api/payment/create-token', ...))

/**
 * Create Payment Transaction (IMPROVED)
 * 
 * Endpoint: POST /api/payment/create-token
 * 
 * Request Body:
 * {
 *   orderId: string (required),
 *   amount: number (required, dalam Rupiah),
 *   customerEmail: string (required),
 *   customerName: string (required),
 *   customerPhone: string (required, digits only),
 *   paymentMethod: string (optional, default 'all')
 *     - 'bank_transfer_bca'
 *     - 'bank_transfer_mandiri'
 *     - 'gopay'
 *     - 'ovo'
 *     - 'dana'
 *     - 'qris'
 *     - 'shopeepay'
 *     - 'all' (show all methods)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   transactionId: string (unique transaction ID),
 *   snapToken: string (for Midtrans Snap.js),
 *   redirectUrl: string (alternative redirect URL),
 *   message: string
 * }
 * 
 * Error Response:
 * {
 *   success: false,
 *   error: string,
 *   transactionId: string (untuk logging)
 * }
 */
app.post('/api/payment/create-token', async (req, res) => {
  try {
    // STEP 1: Rate limiting check
    const rateLimitCheck = rateLimiter.checkLimit(
      req.clientIp,
      10, // max 10 requests
      60  // per 60 seconds
    );

    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfter: rateLimitCheck.resetIn
      });
    }

    // STEP 2: Extract & validate input
    const { orderId, amount, customerEmail, customerName, customerPhone, paymentMethod } = req.body;

    if (!orderId || !amount || !customerEmail || !customerName || !customerPhone) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['orderId', 'amount', 'customerEmail', 'customerName', 'customerPhone']
      });
    }

    // STEP 3: Call PaymentHandler (dengan error handling)
    const result = await paymentHandler.createPaymentTransaction({
      orderId,
      amount,
      customerEmail,
      customerName,
      customerPhone,
      paymentMethod: paymentMethod || 'all',
      ipAddress: req.clientIp,
      userAgent: req.userAgent
    });

    return res.json(result);

  } catch (error) {
    logger.logApiError(
      '/api/payment/create-token',
      'POST',
      500,
      error.message || error.error,
      { orderId: req.body?.orderId }
    );

    return res.status(500).json({
      error: error.error || error.message || 'Failed to create payment token',
      transactionId: error.transactionId
    });
  }
});

// ==========================================
// REPLACE: /api/payment/notification ENDPOINT
// ==========================================
// LOCATION: Replace from line ~415 (app.post('/api/payment/notification', ...))

/**
 * Payment Webhook Notification Handler (IMPROVED & SECURE)
 * 
 * Endpoint: POST /api/payment/notification
 * 
 * Security Features:
 * - Signature verification (SHA256)
 * - Timestamp validation (prevent replay attack)
 * - IP whitelist validation
 * - Idempotency check (prevent double processing)
 * - Atomic database transaction
 * - Comprehensive audit logging
 * 
 * Midtrans will POST to this endpoint with:
 * {
 *   order_id: string,
 *   transaction_id: string,
 *   transaction_status: string ('settlement', 'capture', 'pending', 'deny', 'cancel', 'expire'),
 *   status_code: string,
 *   gross_amount: number,
 *   signature: string (SHA256 signature)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   message: string,
 *   orderId: string,
 *   newStatus: string
 * }
 */
app.post('/api/payment/notification', async (req, res) => {
  try {
    // Webhook processing - ALWAYS return 200 OK to Midtrans
    // (Midtrans expects 200, regardless of processing result)

    // STEP 1: Validate webhook
    try {
      const result = await paymentHandler.processWebhookNotification(
        req.body,
        req.headers,
        req.clientIp
      );

      // Log successful processing
      logger.logWebhookReceived(req.body, req.clientIp);

      // Return 200 OK to Midtrans (important!)
      return res.status(200).json({
        success: true,
        message: result.message,
        isDuplicate: result.isDuplicate || false
      });

    } catch (validationError) {
      // Security validation failed
      logger.logApiError(
        '/api/payment/notification',
        'POST',
        400,
        'Webhook validation failed',
        {
          error: validationError.message,
          orderId: req.body?.order_id,
          ipAddress: req.clientIp
        }
      );

      // Still return 200 OK (don't retry failed webhooks)
      return res.status(200).json({
        success: false,
        message: 'Webhook received but validation failed (logged)',
        reason: 'Security validation failed'
      });
    }

  } catch (error) {
    console.error('[WEBHOOK] Unexpected error:', error);

    // Always return 200 to prevent Midtrans retry
    return res.status(200).json({
      success: false,
      message: 'Webhook received but processing error occurred',
      logged: true
    });
  }
});

// ==========================================
// KEEP EXISTING ENDPOINT (no changes needed)
// ==========================================

/**
 * Get Payment Status
 * 
 * Endpoint: GET /api/payment/status/:orderId
 */
app.get('/api/payment/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const payment = await paymentHandler.getPaymentStatus(orderId);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found for this order' });
    }

    return res.json({
      orderId: payment.order_id,
      transactionId: payment.id,
      midtransTransactionId: payment.midtrans_transaction_id,
      amount: payment.amount,
      status: payment.payment_status,
      method: payment.payment_method,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at,
      settledAt: payment.settlement_time
    });

  } catch (error) {
    logger.logApiError(
      '/api/payment/status/:orderId',
      'GET',
      500,
      error.message
    );

    return res.status(500).json({
      error: 'Failed to fetch payment status'
    });
  }
});

/**
 * Get Payment Configuration (for frontend)
 * No security concern, safe to expose
 */
app.get('/api/payment/config', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const clientKey = isProduction
    ? process.env.MIDTRANS_CLIENT_KEY
    : process.env.MIDTRANS_SANDBOX_CLIENT_KEY;

  const snapUrl = isProduction
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';

  // Check if configured
  if (!clientKey || clientKey === 'YOUR_CLIENT_KEY' || clientKey.startsWith('YOUR_')) {
    return res.status(500).json({
      error: 'Payment gateway not configured',
      message: 'Please configure MIDTRANS_CLIENT_KEY in .env file'
    });
  }

  return res.json({
    clientKey,
    snapUrl,
    environment: isProduction ? 'production' : 'sandbox',
    supportedMethods: [
      'bank_transfer_bca',
      'bank_transfer_mandiri',
      'gopay',
      'ovo',
      'dana',
      'qris',
      'shopeepay'
    ]
  });
});

// ==========================================
// OPTIONAL: REPORTING & MONITORING ENDPOINTS
// ==========================================

/**
 * Get daily payment report (admin only)
 * Endpoint: GET /api/admin/payment/report?date=YYYY-MM-DD
 */
app.get('/api/admin/payment/report', async (req, res) => {
  try {
    // TODO: Add authentication/authorization check
    const date = req.query.date || 'today';
    const report = logger.generateDailyReport(date);

    if (!report) {
      return res.status(404).json({ error: 'No report found for this date' });
    }

    return res.json(report);

  } catch (error) {
    console.error('[REPORT] Error:', error);
    return res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * Get transaction details (admin only)
 * Endpoint: GET /api/admin/transactions/:transactionId
 */
app.get('/api/admin/transactions/:transactionId', async (req, res) => {
  try {
    // TODO: Add authentication/authorization check
    const { transactionId } = req.params;
    const connection = await pool.getConnection();

    const [transaction] = await connection.execute(
      `SELECT * FROM payment_transactions WHERE id = ? LIMIT 1`,
      [transactionId]
    );

    const [webhooks] = await connection.execute(
      `SELECT * FROM payment_webhooks WHERE transaction_id = ? ORDER BY created_at DESC`,
      [transactionId]
    );

    connection.release();

    if (transaction.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    return res.json({
      transaction: transaction[0],
      webhooks: webhooks
    });

  } catch (error) {
    console.error('[TRANSACTION] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// ==========================================
// PERIODIC CLEANUP TASKS
// ==========================================

// Run cleanup every hour
setInterval(() => {
  try {
    // Clean up rate limiter
    rateLimiter.cleanup();

    // Clean up idempotency keys
    idempotencyValidator.cleanup();

    // Rotate old logs (keep 30 days)
    logger.rotateLogs(30);

    console.log('[MAINTENANCE] Cleanup tasks completed');
  } catch (error) {
    console.error('[MAINTENANCE] Cleanup error:', error);
  }
}, 3600000); // 1 hour

// ==========================================
// END OF PAYMENT INTEGRATION UPDATE
// ==========================================
