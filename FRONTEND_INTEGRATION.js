/**
 * FRONTEND INTEGRATION EXAMPLE
 * ==========================================
 * 
 * How to integrate Midtrans Snap payment in your HTML/JS
 * 
 * Add this to checkout.html atau payment page Anda
 */

// ==========================================
// 1. LOAD SNAP.JS IN HTML
// ==========================================
// Add to <head> atau before closing </body>:

/*
<!-- For Sandbox (Testing) -->
<script src="https://app.sandbox.midtrans.com/snap/snap.js"
        data-client-key="YOUR_SANDBOX_CLIENT_KEY"></script>

<!-- For Production -->
<script src="https://app.midtrans.com/snap/snap.js"
        data-client-key="YOUR_PRODUCTION_CLIENT_KEY"></script>
*/

// ==========================================
// 2. JAVASCRIPT PAYMENT INTEGRATION
// ==========================================

class PaymentGateway {
  constructor() {
    this.config = {
      baseUrl: window.location.origin || 'http://localhost:3000'
    };
    this.currentTransaction = null;
  }

  /**
   * Initialize payment gateway
   * Get client key from server
   */
  async initialize() {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/payment/config`);
      const config = await response.json();

      if (!config.clientKey) {
        throw new Error('Payment gateway not configured');
      }

      // Snap sudah loaded dengan data-client-key
      console.log('[PAYMENT] Gateway initialized');
      console.log('Environment:', config.environment);
      return config;
    } catch (error) {
      console.error('[PAYMENT] Initialization error:', error);
      return null;
    }
  }

  /**
   * Create payment transaction
   * Call backend API untuk create token
   */
  async createPaymentToken(orderData) {
    try {
      // Validate input
      if (!orderData.orderId || !orderData.amount || !orderData.customerEmail) {
        throw new Error('Missing required fields');
      }

      console.log('[PAYMENT] Creating token for order:', orderData.orderId);

      // Call backend
      const response = await fetch(`${this.config.baseUrl}/api/payment/create-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: orderData.orderId,
          amount: orderData.amount,
          customerEmail: orderData.customerEmail,
          customerName: orderData.customerName,
          customerPhone: orderData.customerPhone,
          paymentMethod: orderData.paymentMethod || 'all'
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create payment token');
      }

      console.log('[PAYMENT] Token created:', result.transactionId);

      this.currentTransaction = {
        transactionId: result.transactionId,
        orderId: orderData.orderId,
        snapToken: result.snapToken,
        createdAt: new Date()
      };

      return result;

    } catch (error) {
      console.error('[PAYMENT] Token creation error:', error);
      throw error;
    }
  }

  /**
   * Open Midtrans Snap payment page
   */
  openSnapPayment(snapToken) {
    if (!window.snap) {
      throw new Error('Snap library not loaded');
    }

    console.log('[PAYMENT] Opening Snap payment page');

    // Snap.redirect() untuk redirect ke payment page
    window.snap.redirect(snapToken);

    // Atau gunakan Snap.show() untuk modal popup:
    // window.snap.show();
  }

  /**
   * Check payment status
   * Poll backend untuk status terbaru
   */
  async checkPaymentStatus(orderId, maxRetries = 5) {
    try {
      console.log(`[PAYMENT] Checking status for order: ${orderId}`);

      let retries = 0;
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`${this.config.baseUrl}/api/payment/status/${orderId}`);
          const payment = await response.json();

          if (!response.ok) {
            console.warn('[PAYMENT] Order not found:', orderId);
            return;
          }

          console.log('[PAYMENT] Current status:', payment.status);

          // Check if payment complete
          if (['settlement', 'capture'].includes(payment.status)) {
            console.log('[PAYMENT] Payment successful!');
            clearInterval(pollInterval);
            
            // Trigger success callback
            if (this.onPaymentSuccess) {
              this.onPaymentSuccess(payment);
            }
          } else if (['deny', 'cancel', 'expire', 'failed'].includes(payment.status)) {
            console.log('[PAYMENT] Payment failed:', payment.status);
            clearInterval(pollInterval);
            
            // Trigger failure callback
            if (this.onPaymentFailed) {
              this.onPaymentFailed(payment);
            }
          }

          retries++;
          if (retries >= maxRetries) {
            clearInterval(pollInterval);
          }

        } catch (error) {
          console.error('[PAYMENT] Status check error:', error);
          retries++;
          if (retries >= maxRetries) {
            clearInterval(pollInterval);
          }
        }
      }, 3000); // Check every 3 seconds

    } catch (error) {
      console.error('[PAYMENT] Status check error:', error);
      throw error;
    }
  }

  /**
   * Set callback untuk payment success
   */
  onPaymentSuccess(callback) {
    this.onPaymentSuccess = callback;
  }

  /**
   * Set callback untuk payment failed
   */
  onPaymentFailed(callback) {
    this.onPaymentFailed = callback;
  }
}

// ==========================================
// 3. USAGE EXAMPLE
// ==========================================

// Initialize payment gateway
const payment = new PaymentGateway();

// Document ready
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize
  await payment.initialize();

  // Add event listener untuk payment button
  const paymentButton = document.getElementById('pay-button');
  if (paymentButton) {
    paymentButton.addEventListener('click', handlePayment);
  }
});

/**
 * Handle payment button click
 */
async function handlePayment() {
  try {
    // Get order data dari form
    const orderData = {
      orderId: document.getElementById('order-id').value,
      amount: parseInt(document.getElementById('amount').value),
      customerName: document.getElementById('customer-name').value,
      customerEmail: document.getElementById('customer-email').value,
      customerPhone: document.getElementById('customer-phone').value,
      paymentMethod: document.getElementById('payment-method')?.value || 'all'
    };

    console.log('[PAYMENT] Processing payment for:', orderData);

    // Create payment token
    const result = await payment.createPaymentToken(orderData);

    // Open Snap payment page
    payment.openSnapPayment(result.snapToken);

    // Start checking payment status
    payment.onPaymentSuccess(function(payment) {
      alert('Pembayaran berhasil!');
      location.href = '/payment-success.html?order_id=' + payment.orderId;
    });

    payment.onPaymentFailed(function(payment) {
      alert('Pembayaran gagal: ' + payment.status);
      location.href = '/payment-failure.html?order_id=' + payment.orderId;
    });

    payment.checkPaymentStatus(orderData.orderId);

  } catch (error) {
    console.error('[PAYMENT] Error:', error);
    alert('Error: ' + error.message);
  }
}

// ==========================================
// 4. HTML FORM EXAMPLE
// ==========================================

/*
<form id="payment-form">
  <input type="hidden" id="order-id" value="LXM-12345678-ABCD" />
  
  <div class="form-group">
    <label>Nama Lengkap</label>
    <input type="text" id="customer-name" value="John Doe" required />
  </div>

  <div class="form-group">
    <label>Email</label>
    <input type="email" id="customer-email" value="john@example.com" required />
  </div>

  <div class="form-group">
    <label>No Telepon</label>
    <input type="tel" id="customer-phone" value="081234567890" required />
  </div>

  <div class="form-group">
    <label>Metode Pembayaran</label>
    <select id="payment-method">
      <option value="all">Semua Metode</option>
      <option value="bank_transfer_bca">Bank Transfer - BCA</option>
      <option value="bank_transfer_mandiri">Bank Transfer - Mandiri</option>
      <option value="gopay">GoPay</option>
      <option value="ovo">OVO</option>
      <option value="dana">DANA</option>
      <option value="qris">QRIS</option>
    </select>
  </div>

  <div class="form-group">
    <label>Total Pembayaran</label>
    <input type="number" id="amount" value="350000" readonly />
  </div>

  <button type="button" id="pay-button" class="btn btn-primary">
    Lanjutkan Pembayaran
  </button>
</form>
*/

// ==========================================
// 5. SNAP.JS INTEGRATION OPTIONS
// ==========================================

// Option 1: Redirect to payment page
/*
window.snap.redirect(snapToken);
*/

// Option 2: Show as modal popup
/*
window.snap.show();

// Optionally set callbacks:
window.snap.on('snapNotification', function(result){
  console.log('Payment result:', result);
});
*/

// Option 3: Using embed mode
/*
window.snap.embed(snapToken, {
  container: '#snap-container', // ID of container element
  onSuccess: function(result){
    console.log('Payment success:', result);
  },
  onPending: function(result){
    console.log('Payment pending:', result);
  },
  onError: function(result){
    console.log('Payment error:', result);
  },
  onClose: function(){
    console.log('Payment popup closed');
  }
});
*/

// ==========================================
// 6. ERROR HANDLING
// ==========================================

/**
 * Map payment status to user-friendly message
 */
function getPaymentStatusMessage(status) {
  const messages = {
    'pending': 'Menunggu pembayaran...',
    'settlement': 'Pembayaran berhasil!',
    'capture': 'Pembayaran berhasil (pending settlement)',
    'deny': 'Pembayaran ditolak',
    'cancel': 'Pembayaran dibatalkan',
    'expire': 'Pembayaran kadaluarsa',
    'failed': 'Pembayaran gagal',
    'refund': 'Pembayaran dikembalikan'
  };

  return messages[status] || 'Status tidak diketahui';
}

/**
 * Handle payment errors
 */
function handlePaymentError(error) {
  console.error('[PAYMENT ERROR]', error);

  const errorMessages = {
    'Missing required fields': 'Data pembayaran tidak lengkap',
    'Invalid amount': 'Jumlah pembayaran tidak valid',
    'Payment gateway not configured': 'Gateway pembayaran belum dikonfigurasi',
    'Snap library not loaded': 'Library pembayaran tidak terload'
  };

  const message = errorMessages[error.message] || error.message;
  
  // Show error to user
  alert('Error: ' + message);

  // Log error untuk debugging
  console.log({
    error: error.message,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent
  });
}

// ==========================================
// 7. PRODUCTION CONSIDERATIONS
// ==========================================

/*
Security Checklist:

✅ Use HTTPS only (never HTTP untuk production)
✅ Store order data secara server-side
✅ Validate amount di backend (jangan percaya frontend)
✅ Don't expose Server Key di frontend (selalu di backend)
✅ Implement CSRF protection untuk form submission
✅ Log semua payment attempts
✅ Implement rate limiting di backend
✅ Use Content Security Policy (CSP) headers
✅ Monitor untuk fraud indicators
✅ Setup payment timeout handling
*/

// ==========================================
// END OF FRONTEND INTEGRATION EXAMPLE
// ==========================================
