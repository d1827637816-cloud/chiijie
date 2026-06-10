## QUICK START CONFIGURATION GUIDE
## Step-by-Step Setup untuk Payment Integration

---

## STEP 1: MIDTRANS DASHBOARD SETUP (10 menit)

### 1.1 Register dan Login

1. Buka https://midtrans.com/
2. Click "Daftar Sekarang" (Register)
3. Pilih tipe bisnis: "Penjual (Seller)"
4. Isi form dengan data bisnis Anda
5. Verify email Anda
6. Login ke dashboard

### 1.2 Get API Keys

1. Dari sidebar, pilih **Settings** → **Access Keys**
2. Anda akan lihat 2 environment:

   **SANDBOX (untuk testing):**
   - Server Key: `SB-Mid-server-xxxxxxxxxxxxxxxxxxxx`
   - Client Key: `SB-Mid-client-xxxxxxxxxxxxxxxxxxxx`

   **PRODUCTION (untuk live):**
   - Server Key: `Mid-server-xxxxxxxxxxxxxxxxxxxx`
   - Client Key: `Mid-client-xxxxxxxxxxxxxxxxxxxx`

3. **Copy kedua keys untuk sandbox** (kita gunakan untuk testing dulu)

### 1.3 Enable Webhook Notifications

1. Di dashboard, pilih **Settings** → **Notification URL**
2. Set notification URL ke: `http://localhost:3000/api/payment/notification`
   (Untuk testing, bisa gunakan ngrok untuk expose localhost)
3. Enable notifikasi untuk:
   - ✅ Payment confirmation
   - ✅ Settlement report
4. Click Save

---

## STEP 2: LOCAL SETUP (15 menit)

### 2.1 Clone / Prepare Project

```bash
cd /workspaces/chiijiie_outfit
npm install
```

### 2.2 Setup Environment Variables

```bash
# Copy template
cp .env.example .env

# Edit .env
nano .env  # atau gunakan editor lainnya
```

Isi dengan value Anda:

```env
# --- NODE ENVIRONMENT ---
NODE_ENV=development
PORT=3000

# --- DATABASE ---
DB_HOST=localhost
DB_USER=root
DB_PASS=  # (empty jika default)
DB_NAME=webtokobajuu

# --- MIDTRANS (SANDBOX)
MIDTRANS_SANDBOX_SERVER_KEY=SB-Mid-server-COPY_HERE
MIDTRANS_SANDBOX_CLIENT_KEY=SB-Mid-client-COPY_HERE

# --- MIDTRANS (PRODUCTION - set nanti)
MIDTRANS_SERVER_KEY=Mid-server-COPY_LATER
MIDTRANS_CLIENT_KEY=Mid-client-COPY_LATER

# --- WEBHOOK SECURITY
MIDTRANS_WEBHOOK_SECRET=your_super_secure_webhook_secret_32_chars_minimum

# --- PAYMENT URLS
PAYMENT_SUCCESS_URL=http://localhost:3000/payment-success.html
PAYMENT_FAILURE_URL=http://localhost:3000/payment-failure.html
PAYMENT_PENDING_URL=http://localhost:3000/payment-pending.html

# --- LOGGING
LOG_LEVEL=info
LOG_DIR=./logs
ENABLE_TRANSACTION_LOGGING=true
```

### 2.3 Create Directories

```bash
# Create logs directory
mkdir -p logs
mkdir -p migrations
mkdir -p lib
```

### 2.4 Run Database Migration

```bash
# Ensure MySQL service running
# mysql -u root < migrations/001_payment_system.sql

# Atau gunakan phpMyAdmin:
# 1. Buka http://localhost/phpmyadmin
# 2. Select database 'webtokobajuu'
# 3. Click "Import" tab
# 4. Pilih file migrations/001_payment_system.sql
# 5. Click "Go"
```

Verify migration berhasil:
```bash
mysql -u root webtokobajuu -e "SHOW TABLES LIKE 'payment%';"
```

Output seharusnya:
```
payment_transactions
payment_webhooks
payment_refunds
payment_settlement
payment_fraud_logs
payment_retry_queue
```

---

## STEP 3: UPDATE SERVER.JS (20 menit)

### 3.1 Add Imports (Top of server.js)

Setelah `const bodyParser = require('body-parser');`, tambahkan:

```javascript
// Import payment modules
const PaymentHandler = require('./lib/payment-handler');
const { MidtransSignatureValidator, RateLimiter, IdempotencyValidator } = require('./lib/security-utils');
const TransactionLogger = require('./lib/transaction-logger');
```

### 3.2 Initialize Payment Handler (After database setup)

Setelah `const pool = mysql.createPool({...})`, tambahkan:

```javascript
// Initialize payment utilities
const logger = new TransactionLogger(process.env.LOG_DIR || './logs');
const rateLimiter = new RateLimiter();
const idempotencyValidator = new IdempotencyValidator();

// Initialize Payment Handler
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
```

### 3.3 Add Middleware (After app.use(bodyParser...))

```javascript
// Capture client IP & User-Agent
app.use((req, res, next) => {
  req.clientIp = req.headers['x-forwarded-for']?.split(',')[0]
    || req.headers['x-real-ip']
    || req.connection.remoteAddress
    || '0.0.0.0';
  
  req.userAgent = req.headers['user-agent'] || '';
  next();
});
```

### 3.4 Replace Payment Endpoints

Lihat file `PAYMENT_ENDPOINTS_UPDATE.js` dan ganti/update endpoints:
- `POST /api/payment/create-token`
- `POST /api/payment/notification`
- `GET /api/payment/status/:orderId`
- `GET /api/payment/config`

---

## STEP 4: VERIFY FILES EXIST

Pastikan files berikut ada:

```bash
# Check library files
ls -la lib/payment-handler.js
ls -la lib/security-utils.js
ls -la lib/transaction-logger.js

# Check migration
ls -la migrations/001_payment_system.sql

# Check documentation
ls -la PAYMENT_INTEGRATION.md
ls -la PAYMENT_ENDPOINTS_UPDATE.js
```

---

## STEP 5: START SERVER

```bash
# Start server
npm start

# atau jika ada nodemon:
npm run dev

# atau direct:
node server.js
```

Expected output:
```
LUXE.M Server running on http://localhost:3000
Midtrans Mode: SANDBOX
```

---

## STEP 6: TEST PAYMENT FLOW

### 6.1 Create Order

```bash
curl -X POST http://localhost:3000/api/orders/create \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "test@example.com",
    "phone": "081234567890",
    "address": "Test Address",
    "city": "Jakarta",
    "province": "DKI Jakarta",
    "shippingMethod": "regular",
    "paymentMethod": "bank_transfer_bca",
    "cart": [
      {
        "id": "p1",
        "name": "Premium White Linen Shirt",
        "brand": "MANGO MAN",
        "price": 350000,
        "quantity": 1
      }
    ],
    "subtotal": 350000,
    "shippingCost": 15000,
    "discount": 0
  }'
```

Response:
```json
{
  "success": true,
  "orderId": "LXM-12345678-ABCD",
  "total": 365000,
  "customerId": 1
}
```

### 6.2 Create Payment Token

```bash
curl -X POST http://localhost:3000/api/payment/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "LXM-12345678-ABCD",
    "amount": 365000,
    "customerEmail": "test@example.com",
    "customerName": "John Doe",
    "customerPhone": "081234567890",
    "paymentMethod": "all"
  }'
```

Response:
```json
{
  "success": true,
  "transactionId": "TRX-1718123456789-abc123",
  "snapToken": "eyJpZCI6IjcwZTZi...",
  "redirectUrl": "https://app.sandbox.midtrans.com/snap/v4/redirection/...",
  "message": "Payment transaction created successfully"
}
```

### 6.3 Open Payment Page

Copy `redirectUrl` dan buka di browser. Atau gunakan Snap.js:

```html
<script src="https://app.sandbox.midtrans.com/snap/snap.js"
        data-client-key="YOUR_CLIENT_KEY"></script>
<script>
  snap.redirect('eyJpZCI6IjcwZTZi...');
</script>
```

### 6.4 Complete Payment

1. Di sandbox payment page, pilih payment method (e.g., "Bank Transfer - BCA")
2. Untuk test credit card:
   - Card: 4811 1111 1111 1114
   - Expiry: 12/25
   - CVV: 123
   - 3DS: 112233
3. Click "Bayar"

### 6.5 Check Payment Status

```bash
curl http://localhost:3000/api/payment/status/LXM-12345678-ABCD
```

Response:
```json
{
  "orderId": "LXM-12345678-ABCD",
  "transactionId": "TRX-1718123456789-abc123",
  "amount": 365000,
  "status": "settlement",
  "method": "bank_transfer_bca",
  "createdAt": "2024-06-10T10:30:00.000Z",
  "updatedAt": "2024-06-10T10:35:00.000Z",
  "settledAt": "2024-06-10T10:35:00.000Z"
}
```

### 6.6 Check Logs

```bash
# View transaction logs
tail -f logs/transactions-$(date +%Y-%m-%d).log

# View webhook logs
tail -f logs/webhooks-$(date +%Y-%m-%d).log

# View error logs
tail -f logs/errors-$(date +%Y-%m-%d).log
```

---

## STEP 7: NGROK SETUP (Testing Webhooks Locally)

Untuk test webhook, kita perlu expose localhost ke internet:

### 7.1 Install & Run ngrok

```bash
# Download dari https://ngrok.com/download atau:
brew install ngrok

# Start ngrok
ngrok http 3000

# Output:
# ngrok by @inconshreveable
# Forwarding    https://xxxx-xx-xxx-xx-xx.ngrok.io -> http://localhost:3000
```

### 7.2 Update Midtrans Dashboard

1. Go to https://dashboard.midtrans.com
2. Settings → Notification URL
3. Change to: `https://xxxx-xx-xxx-xx-xx.ngrok.io/api/payment/notification`
4. Save

### 7.3 Test Webhook

Di Midtrans dashboard, click "Send Test Notification":
1. Success notification akan send ke ngrok URL
2. Forward ke localhost:3000
3. Backend process dan log ke `logs/webhooks-*.log`

Check log:
```bash
tail -f logs/webhooks-$(date +%Y-%m-%d).log
```

---

## STEP 8: PRODUCTION DEPLOYMENT

Ketika siap untuk production:

### 8.1 Update Keys

```bash
# Set production keys di .env
MIDTRANS_SERVER_KEY=Mid-server-YOUR_PRODUCTION_KEY
MIDTRANS_CLIENT_KEY=Mid-client-YOUR_PRODUCTION_KEY
NODE_ENV=production
```

### 8.2 Configure URLs

```bash
# Use production domain
PAYMENT_WEBHOOK_URL=https://yourdomain.com/api/payment/notification
PAYMENT_SUCCESS_URL=https://yourdomain.com/payment-success.html
PAYMENT_FAILURE_URL=https://yourdomain.com/payment-failure.html
```

### 8.3 Update Midtrans Dashboard

1. Settings → Notification URL
2. Change to: `https://yourdomain.com/api/payment/notification`

### 8.4 Enable HTTPS Certificate

```bash
# Install Let's Encrypt
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Certificate location:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### 8.5 Update Server Configuration

```bash
# Update nginx/apache to use HTTPS
# Or configure Node.js directly:
```

```javascript
const fs = require('fs');
const https = require('https');

const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/yourdomain.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/yourdomain.com/fullchain.pem')
};

https.createServer(options, app).listen(443);
```

### 8.6 Deploy & Restart

```bash
# Deploy code
git pull origin main
npm install

# Restart server
systemctl restart luxem-server
```

### 8.7 Test Production Webhook

```bash
curl -X POST https://yourdomain.com/api/payment/notification \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "LXM-test-prod",
    "transaction_id": "test-123",
    "transaction_status": "settlement",
    "status_code": "200",
    "gross_amount": "350000"
  }'
```

---

## TROUBLESHOOTING

### Problem: "Cannot find module 'payment-handler'"

**Solution:**
```bash
# Make sure file exists
ls -la lib/payment-handler.js

# Check server.js import path
nano server.js
# Change: require('./lib/payment-handler')
```

### Problem: "Midtrans Server Key undefined"

**Solution:**
```bash
# Check .env file
cat .env | grep MIDTRANS

# If missing, add to .env:
MIDTRANS_SANDBOX_SERVER_KEY=SB-Mid-server-xxxxx
```

### Problem: "Database Error: payment_transactions table not found"

**Solution:**
```bash
# Run migration
mysql -u root webtokobajuu < migrations/001_payment_system.sql

# Verify
mysql -u root webtokobajuu -e "SHOW TABLES;"
```

### Problem: "Webhook not received"

**Solution:**
1. Check notification URL di Midtrans dashboard correct
2. If localhost, use ngrok
3. Check firewall allowing incoming connections
4. Verify HTTPS certificate valid for production

---

## SUCCESS INDICATORS ✅

Ketika setup berhasil, Anda akan lihat:

```
✅ npm start runs without errors
✅ Logs created: logs/transactions-*.log
✅ POST /api/payment/create-token returns snapToken
✅ Payment page opens (Midtrans Snap)
✅ Webhook logs created after payment
✅ Order status updated to "paid" in database
✅ No errors in error logs
```

---

## NEXT STEPS

After basic setup working:

1. **Customize UI** - Match payment page dengan brand Anda
2. **Setup Admin Dashboard** - View payment reports & transaction history
3. **Implement Refund** - Add refund functionality untuk return/cancel
4. **Add Email Notifications** - Send confirmation emails
5. **Setup Monitoring** - Alert jika ada failed payments
6. **Performance Optimization** - Caching, CDN, database optimization

---

**Status**: Ready for Testing ✅  
**Contact**: If stuck, check PAYMENT_INTEGRATION.md untuk details lebih lengkap
