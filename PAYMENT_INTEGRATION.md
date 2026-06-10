# PAYMENT INTEGRATION DOCUMENTATION
## Production-Ready Real Payment System for LUXE.M

---

## TABLE OF CONTENTS
1. [Architecture Overview](#architecture-overview)
2. [Setup Instructions](#setup-instructions)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Security Features](#security-features)
6. [Webhook Configuration](#webhook-configuration)
7. [Testing & Sandbox](#testing--sandbox)
8. [Production Deployment](#production-deployment)
9. [Troubleshooting](#troubleshooting)

---

## ARCHITECTURE OVERVIEW

### System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ CUSTOMER (Frontend)                                             │
└────────────────────────┬────────────────────────────────────────┘
                         │ 1. Create Order
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND API (/api/orders/create)                               │
│ - Validate order                                                │
│ - Store order in DB                                             │
│ - Return orderId                                                │
└────────────────────────┬────────────────────────────────────────┘
                         │ 2. Get Snap Token
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND API (/api/payment/create-token)                        │
│ - Validate payment request                                      │
│ - Call PaymentHandler                                           │
│ - Record transaction in DB                                      │
│ - Get Snap token from Midtrans                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │ 3. Return Token
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Snap.js Redirect                                      │
│ - Load Snap payment page                                        │
│ - Customer choose payment method                                │
│ - Customer complete payment                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │ 4. Redirect
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Payment Status Page                                   │
│ - Show payment result                                           │
│ - Poll for status update                                        │
└─────────────────────────────────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼ 5. Webhook          ▼ 6. API Check
    ┌─────────────────────┐    ┌──────────────────┐
    │ MIDTRANS WEBHOOK    │    │ BACKEND API      │
    │ /api/payment/       │    │ /api/payment/    │
    │  notification       │    │  status/:orderId │
    │                     │    │                  │
    │ - Signature Verify  │    │ - Return status  │
    │ - Process txn       │    │                  │
    │ - Update DB         │    │                  │
    └─────────────────────┘    └──────────────────┘
              │                     │
              └──────────┬──────────┘
                         ▼
            ┌──────────────────────────┐
            │ ORDER STATUS UPDATED     │
            │ - Payment: Paid/Failed   │
            │ - Order: Processing      │
            └──────────────────────────┘
```

### Module Architecture

```
server.js (Main Express App)
  ├── lib/
  │   ├── payment-handler.js (Main payment logic)
  │   ├── security-utils.js (Encryption, signature verification)
  │   └── transaction-logger.js (Audit logging)
  ├── migrations/
  │   └── 001_payment_system.sql (Database schema)
  └── .env (Configuration & secrets)
```

---

## SETUP INSTRUCTIONS

### 1. Install Dependencies

```bash
npm install dotenv midtrans-client mysql2 express cors body-parser
```

**File: package.json**
Seharusnya sudah memiliki dependencies ini, jika belum tambahkan:

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mysql2": "^3.6.5",
    "midtrans-client": "^1.3.1",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "body-parser": "^1.20.2"
  }
}
```

### 2. Create Midtrans Account & Get Keys

**Step 1: Register di Midtrans**
- Buka https://midtrans.com/
- Register akun bisnis Anda
- Verify email

**Step 2: Login ke Dashboard**
- URL: https://dashboard.midtrans.com
- Navigate to: **Settings → Access Keys**

**Step 3: Copy Keys**
Anda akan melihat 2 set key untuk setiap environment:

```
SANDBOX (Testing)
├── Server Key:  SB-Mid-server-xxxxxxxxxxxxxxxxxxxx
└── Client Key:  SB-Mid-client-xxxxxxxxxxxxxxxxxxxx

PRODUCTION (Live)
├── Server Key:  Mid-server-xxxxxxxxxxxxxxxxxxxx
└── Client Key:  Mid-client-xxxxxxxxxxxxxxxxxxxx
```

### 3. Configure .env File

**Copy .env.example to .env:**
```bash
cp .env.example .env
```

**Edit .env dengan keys Anda:**
```bash
# NODE ENVIRONMENT
NODE_ENV=development  # Use 'production' for live

# DATABASE
DB_HOST=localhost
DB_USER=root
DB_PASS=your_secure_password
DB_NAME=webtokobajuu

# MIDTRANS KEYS (use SANDBOX for development)
MIDTRANS_SANDBOX_SERVER_KEY=SB-Mid-server-YOUR_KEY_HERE
MIDTRANS_SANDBOX_CLIENT_KEY=SB-Mid-client-YOUR_KEY_HERE

# For production (later)
MIDTRANS_SERVER_KEY=Mid-server-YOUR_PRODUCTION_KEY
MIDTRANS_CLIENT_KEY=Mid-client-YOUR_PRODUCTION_KEY

# WEBHOOK SECURITY
MIDTRANS_WEBHOOK_SECRET=your_super_secure_webhook_secret_32_chars_minimum_!!!

# URL untuk redirect setelah payment
PAYMENT_SUCCESS_URL=http://localhost:3000/payment-success.html
PAYMENT_FAILURE_URL=http://localhost:3000/payment-failure.html
PAYMENT_PENDING_URL=http://localhost:3000/payment-pending.html

# For production, use HTTPS URLs:
# PAYMENT_SUCCESS_URL=https://yourdomain.com/payment-success.html
# PAYMENT_WEBHOOK_URL=https://yourdomain.com/api/payment/notification
```

### 4. Run Database Migration

```bash
mysql -u root -p webtokobajuu < migrations/001_payment_system.sql
```

Atau gunakan phpMyAdmin:
- Open phpMyAdmin
- Select database `webtokobajuu`
- Click "Import"
- Choose file `migrations/001_payment_system.sql`
- Click "Go"

### 5. Update server.js

Lihat file `PAYMENT_ENDPOINTS_UPDATE.js` dan:
1. Add payment module imports (lines 1-15)
2. Initialize PaymentHandler dan security modules (setelah database setup)
3. Add middleware untuk capture IP address
4. Replace old payment endpoints dengan new ones

Atau gunakan versi baru dari file ini.

### 6. Start Server

```bash
npm start
# atau
node server.js
```

Server akan berjalan di: `http://localhost:3000`

---

## DATABASE SCHEMA

### Main Tables

#### 1. payment_transactions
Stores all payment attempts

```sql
CREATE TABLE payment_transactions (
  id VARCHAR(64) PRIMARY KEY,              -- TRX-timestamp-random
  order_id VARCHAR(32) NOT NULL,           -- Link ke orders
  midtrans_transaction_id VARCHAR(64),     -- From Midtrans
  snap_token VARCHAR(255),                 -- Snap token
  amount BIGINT UNSIGNED,                  -- Amount in Rupiah
  currency VARCHAR(3),                     -- IDR
  payment_method VARCHAR(64),              -- bank_transfer_bca, gopay, etc
  payment_status ENUM(...),                -- pending, settlement, capture, deny, expire, failed
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),
  fraud_status VARCHAR(50),                -- From Midtrans fraud detection
  ip_address VARCHAR(45),                  -- Customer IP
  user_agent VARCHAR(500),                 -- Browser info
  created_at DATETIME,
  updated_at DATETIME,
  settlement_time DATETIME,                -- When paid
  webhook_received_at DATETIME
);
```

#### 2. payment_webhooks
Audit trail untuk semua webhook dari Midtrans

```sql
CREATE TABLE payment_webhooks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  webhook_id VARCHAR(64) UNIQUE,           -- Prevent duplicates
  transaction_id VARCHAR(64),
  order_id VARCHAR(32),
  event_type VARCHAR(50),
  transaction_status VARCHAR(50),
  payload LONGTEXT,                        -- Full JSON payload
  signature_verified BOOLEAN,              -- Verification result
  ip_address VARCHAR(45),
  processing_status ENUM(
    'pending',
    'processed',
    'failed',
    'duplicate',
    'ignored'
  ),
  created_at DATETIME,
  processed_at DATETIME
);
```

#### 3. payment_refunds
Untuk tracking refund requests

```sql
CREATE TABLE payment_refunds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id VARCHAR(64),              -- Link ke payment_transactions
  order_id VARCHAR(32),
  refund_amount BIGINT UNSIGNED,           -- Amount to refund
  refund_reason VARCHAR(255),
  refund_status ENUM(
    'requested',
    'approved',
    'processing',
    'completed',
    'failed'
  ),
  midtrans_refund_id VARCHAR(100),         -- From Midtrans
  requested_by VARCHAR(255),
  approved_by VARCHAR(255),
  created_at DATETIME,
  completed_at DATETIME
);
```

#### 4. payment_fraud_logs
Fraud detection records

```sql
CREATE TABLE payment_fraud_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id VARCHAR(64),
  fraud_indicator VARCHAR(100),            -- Type of fraud
  fraud_score DECIMAL(5,2),                -- 0-100
  action_taken ENUM(
    'flagged',
    'blocked',
    'manual_review',
    'allowed',
    'challenged'
  ),
  created_at DATETIME
);
```

---

## API ENDPOINTS

### 1. Create Payment Transaction

**Endpoint:** `POST /api/payment/create-token`

**Request:**
```json
{
  "orderId": "LXM-12345678-ABCD",
  "amount": 350000,
  "customerEmail": "customer@email.com",
  "customerName": "John Doe",
  "customerPhone": "081234567890",
  "paymentMethod": "all"
}
```

**Payment Methods:**
- `bank_transfer_bca` - BCA Bank Transfer
- `bank_transfer_mandiri` - Mandiri Bank Transfer
- `gopay` - GoPay E-Wallet
- `ovo` - OVO E-Wallet
- `dana` - DANA E-Wallet
- `qris` - QRIS Dynamic QR
- `shopeepay` - ShopeePay E-Wallet
- `all` - Show all methods

**Success Response (200):**
```json
{
  "success": true,
  "transactionId": "TRX-1718123456789-abc123",
  "snapToken": "eyJpZCI6IjcwZTZiNDIwLWZkZDUtNGI1MS1iNzkyLWE5YzU5M2ZjZjM1MiIsInV0YSI6IjA5ZTI0M2Q2LTcwMzgtNDhiZi04NDk4LWY0MDk0YWI5NDYxOSIsImNoYW5uZWxzIjp9",
  "redirectUrl": "https://app.sandbox.midtrans.com/snap/v4/redirection/70e6b420-fdd5-4b51-b792-a9c593fcf352",
  "message": "Payment transaction created successfully"
}
```

**Error Response (400/500):**
```json
{
  "success": false,
  "error": "Invalid amount: 5000. Must be between 10000 and 50000000",
  "transactionId": "TRX-1718123456789-abc123"
}
```

### 2. Get Payment Status

**Endpoint:** `GET /api/payment/status/:orderId`

**Example:**
```
GET /api/payment/status/LXM-12345678-ABCD
```

**Response (200):**
```json
{
  "orderId": "LXM-12345678-ABCD",
  "transactionId": "TRX-1718123456789-abc123",
  "midtransTransactionId": "70e6b420-fdd5-4b51-b792-a9c593fcf352",
  "amount": 350000,
  "status": "settlement",
  "method": "bank_transfer_bca",
  "createdAt": "2024-06-10T10:30:00.000Z",
  "updatedAt": "2024-06-10T10:35:00.000Z",
  "settledAt": "2024-06-10T10:35:00.000Z"
}
```

### 3. Payment Webhook (Midtrans → Backend)

**Endpoint:** `POST /api/payment/notification`

**Called by:** Midtrans (automatic)

**Midtrans sends:**
```json
{
  "order_id": "LXM-12345678-ABCD",
  "transaction_id": "70e6b420-fdd5-4b51-b792-a9c593fcf352",
  "transaction_status": "settlement",
  "status_code": "200",
  "gross_amount": "350000",
  "signature": "8d5a6f7b8c9d0e1f2a3b4c5d6e7f8a9b"
}
```

**Backend Response (200):**
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "isDuplicate": false
}
```

### 4. Get Payment Configuration

**Endpoint:** `GET /api/payment/config`

**Response:**
```json
{
  "clientKey": "SB-Mid-client-xxxxxxxxxxxxxxxxxxxx",
  "snapUrl": "https://app.sandbox.midtrans.com/snap/snap.js",
  "environment": "sandbox",
  "supportedMethods": [
    "bank_transfer_bca",
    "bank_transfer_mandiri",
    "gopay",
    "ovo",
    "dana",
    "qris",
    "shopeepay"
  ]
}
```

---

## SECURITY FEATURES

### 1. Webhook Signature Verification

Midtrans signs every webhook dengan SHA256. Backend verify sebelum process.

**Formula:**
```
Signature = SHA256(order_id + status_code + gross_amount + ServerKey)
```

**Implementation:**
```javascript
const validator = new MidtransSignatureValidator(serverKey);
const isValid = validator.validateSignature(notification, signature);
```

**Security Benefit:**
- Memastikan webhook dari Midtrans, bukan attacker
- Mencegah man-in-the-middle attack

### 2. Timestamp Validation (Replay Attack Prevention)

Setiap webhook punya timestamp. Check jangan terlalu lama.

```javascript
const isValid = validator.validateTimestamp(timestamp, 300); // Max 5 menit
```

### 3. IP Whitelist Validation

Verify webhook datang dari Midtrans IP address.

```javascript
const ipValid = validator.validateIpAddress(remoteIp, whitelist);
```

**Midtrans IP Ranges (Production):**
```
103.153.122.0/24
103.231.84.0/24
103.46.137.0/24
202.43.172.0/24
```

### 4. Idempotency (Prevent Double Processing)

Jika webhook duplikat (network retry), jangan proses 2x.

```javascript
// Check if webhook_id already processed
const existingRecord = db.query('SELECT * FROM payment_webhooks WHERE webhook_id = ?', webhookId);
if (existingRecord && processed) {
  return 'Already processed';
}
```

### 5. Rate Limiting

Limit payment creation requests dari IP yang sama.

```javascript
const rateLimitCheck = rateLimiter.checkLimit(
  clientIp,
  10,  // max 10 requests
  60   // per 60 seconds
);

if (!rateLimitCheck.allowed) {
  return 429; // Too many requests
}
```

### 6. Amount Validation

Check amount dalam range yang valid.

```javascript
if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
  throw new Error('Invalid amount');
}
```

### 7. Data Encryption (Optional)

Untuk data sensitif seperti card tokens:

```javascript
const encryption = new DataEncryption(encryptionKey);
const encrypted = encryption.encrypt(sensitiveData);
const decrypted = encryption.decrypt(encrypted);
```

### 8. Atomic Database Transactions

Update database dengan transaction, jika error rollback semua.

```sql
START TRANSACTION;
  UPDATE payment_transactions SET status = 'paid' WHERE id = ?;
  UPDATE orders SET status = 'processing' WHERE id = ?;
COMMIT;
-- Jika error: ROLLBACK
```

### 9. Environment Variables

Semua secret key disimpan di .env, bukan di source code.

```
MIDTRANS_SERVER_KEY=xxx (bukan di git)
WEBHOOK_SECRET=xxx
```

### 10. Comprehensive Logging

Semua transaction dilog untuk audit trail.

```
logs/
  transactions-2024-06-10.log
  webhooks-2024-06-10.log
  errors-2024-06-10.log
```

---

## WEBHOOK CONFIGURATION

### Midtrans Dashboard Setup

**Step 1: Login to Dashboard**
- URL: https://dashboard.midtrans.com
- Navigate to: **Settings → Notification URL**

**Step 2: Set Webhook URL**

**For SANDBOX (Testing):**
```
https://yourlocalhost:3000/api/payment/notification
# atau
http://localhost:3000/api/payment/notification
```

**For PRODUCTION:**
```
https://yourdomain.com/api/payment/notification
```

**Important:** Webhook URL MUST:
- ✅ Accessible dari internet (Midtrans servers)
- ✅ Use HTTPS untuk production (HTTP hanya untuk testing)
- ✅ Respond dengan 200 OK (bahkan jika error processing)
- ✅ Process cepat, jangan timeout

**Step 3: Enable Webhooks**
- Checkboxes untuk enable:
  - ✅ Payment confirmation
  - ✅ Settlement report
  - ✅ Payout report (jika menggunakan payout)

**Step 4: Test Webhook**
- Klik "Send Test Notification"
- Check logs: `logs/webhooks-YYYY-MM-DD.log`
- Verify signature verification berhasil

### Local Testing dengan ngrok

Jika develop locally, gunakan ngrok untuk expose localhost ke internet:

```bash
# Install ngrok
brew install ngrok

# Expose port 3000
ngrok http 3000

# Midtrans webhook URL
https://xxxx-xx-xxx-xx-xx.ngrok.io/api/payment/notification

# Test webhook (akan forward ke localhost:3000)
```

---

## TESTING & SANDBOX

### Test Credit Card (Sandbox)

**Visa Card (Success):**
```
Card Number: 4811 1111 1111 1114
Expiry: 12/25
CVV: 123
3DS Password: 112233
```

**Visa Card (Deny/Reject):**
```
Card Number: 4111 1111 1111 1110
Expiry: 12/25
CVV: 123
```

### Test E-Wallets (Sandbox)

**GoPay:**
- Automatically approved in sandbox

**OVO:**
- Enter any 10-digit number
- Automatically approved

**DANA:**
- Enter any 10-digit number
- Automatically approved

### Manual Testing Steps

1. **Create Order**
   ```bash
   curl -X POST http://localhost:3000/api/orders/create \
     -H "Content-Type: application/json" \
     -d '{
       "firstName": "John",
       "lastName": "Doe",
       "email": "test@example.com",
       "phone": "081234567890",
       "address": "Jl. Test 123",
       "city": "Jakarta",
       "province": "DKI Jakarta",
       "shippingMethod": "regular",
       "paymentMethod": "bank_transfer_bca",
       "cart": [{"id": "p1", "name": "Shirt", "brand": "Brand", "price": 350000, "quantity": 1}],
       "subtotal": 350000,
       "shippingCost": 0,
       "discount": 0
     }'
   ```

2. **Create Payment Token**
   ```bash
   curl -X POST http://localhost:3000/api/payment/create-token \
     -H "Content-Type: application/json" \
     -d '{
       "orderId": "LXM-12345678-ABCD",
       "amount": 350000,
       "customerEmail": "test@example.com",
       "customerName": "John Doe",
       "customerPhone": "081234567890",
       "paymentMethod": "all"
     }'
   ```

3. **Check Logs**
   ```bash
   tail -f logs/transactions-$(date +%Y-%m-%d).log
   ```

4. **Simulate Webhook (testing)**
   ```bash
   curl -X POST http://localhost:3000/api/payment/notification \
     -H "Content-Type: application/json" \
     -H "X-Appended-Signature: signature_here" \
     -d '{
       "order_id": "LXM-12345678-ABCD",
       "transaction_id": "test-123",
       "transaction_status": "settlement",
       "status_code": "200",
       "gross_amount": "350000"
     }'
   ```

---

## PRODUCTION DEPLOYMENT

### Pre-Deployment Checklist

- [ ] Change `NODE_ENV=production` di .env
- [ ] Use production Midtrans keys (bukan sandbox)
- [ ] Set webhook URL ke domain production HTTPS
- [ ] Configure database replication/backup
- [ ] Enable HTTPS certificate (Let's Encrypt)
- [ ] Set up monitoring & alerting
- [ ] Configure log rotation
- [ ] Test webhook dengan production keys
- [ ] Set up daily backup
- [ ] Configure payment retry mechanism

### Environment Variables (Production)

```bash
NODE_ENV=production
DB_HOST=production_db_server
DB_USER=prod_user
DB_PASS=strong_password_32_chars
MIDTRANS_SERVER_KEY=Mid-server-PRODUCTION_KEY
MIDTRANS_CLIENT_KEY=Mid-client-PRODUCTION_KEY
MIDTRANS_WEBHOOK_SECRET=super_secure_random_32_chars
PAYMENT_WEBHOOK_URL=https://yourdomain.com/api/payment/notification
PAYMENT_SUCCESS_URL=https://yourdomain.com/payment-success.html
PAYMENT_FAILURE_URL=https://yourdomain.com/payment-failure.html
LOG_LEVEL=info
ENABLE_TRANSACTION_LOGGING=true
```

### Deployment Steps

1. **Update Production Server**
   ```bash
   cd /var/www/luxem
   git pull origin main
   npm install
   ```

2. **Run Database Migration**
   ```bash
   mysql -u root -p webtokobajuu < migrations/001_payment_system.sql
   ```

3. **Restart Application**
   ```bash
   systemctl restart luxem-server
   ```

4. **Verify Health Check**
   ```bash
   curl https://yourdomain.com/api/payment/config
   ```

---

## TROUBLESHOOTING

### Issue 1: "Midtrans belum dikonfigurasi"

**Cause:** Environment variables belum di-set

**Fix:**
```bash
# Check .env
cat .env | grep MIDTRANS

# If empty, update .env dengan keys Anda
# Then restart server
npm start
```

### Issue 2: Webhook "Signature Mismatch"

**Cause:** Server key salah atau webhook payload tampered

**Fix:**
1. Verify MIDTRANS_SERVER_KEY di .env tepat (copy dari dashboard)
2. Check logs untuk detail error: `logs/webhooks-*.log`
3. Test dengan Midtrans test notification dari dashboard

### Issue 3: Payment Status Stuck in "Pending"

**Cause:** Webhook tidak diterima atau tidak diproses

**Fix:**
1. Check webhook URL di Midtrans dashboard
2. Check logs: `logs/webhooks-*.log`
3. Verify HTTPS certificate valid
4. Test endpoint manual: `curl -X POST https://yourdomain.com/api/payment/notification`

### Issue 4: Database Connection Error

**Cause:** Database tidak accessible

**Fix:**
```bash
# Check MySQL service
systemctl status mysql

# Check credentials di .env
mysql -u $DB_USER -p$DB_PASS -h $DB_HOST -e "USE $DB_NAME; SELECT COUNT(*) FROM payment_transactions;"
```

### Issue 5: Rate Limited (429 Error)

**Cause:** Too many payment requests dari IP yang sama

**Fix:**
- Wait untuk reset window (60 seconds default)
- Increase limit di config jika legitimate: `PAYMENT_RATE_LIMIT_MAX_REQUESTS=50`

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Watch logs in real-time
tail -f logs/transactions-$(date +%Y-%m-%d).log
tail -f logs/webhooks-$(date +%Y-%m-%d).log
tail -f logs/errors-$(date +%Y-%m-%d).log
```

---

## FILE STRUCTURE

```
/
├── server.js (Main Express app - UPDATE with new endpoints)
├── package.json (Dependencies)
├── .env (Configuration - KEEP SECRET, add to .gitignore)
├── .env.example (Template)
│
├── lib/
│   ├── payment-handler.js (Main payment logic)
│   ├── security-utils.js (Signature verification, encryption, rate limiting)
│   └── transaction-logger.js (Comprehensive logging)
│
├── migrations/
│   └── 001_payment_system.sql (Database schema)
│
├── logs/ (Auto-created)
│   ├── transactions-2024-06-10.log
│   ├── webhooks-2024-06-10.log
│   ├── errors-2024-06-10.log
│   └── ...
│
└── public/
    └── uploads/
```

---

## PAYMENT STATUS FLOW

```
Payment Status States:

pending
  ├─→ (payment in progress)
  ├─→ capture (berhasil, but not settled yet)
  │   └─→ settlement (berhasil, dana diterima)
  └─→ deny (payment ditolak)
       expire (timeout)
       cancel (dibatalkan)
       failed (error)
       refund (dikembalikan)

Frontend Display:

"Menunggu Pembayaran" (pending, capture, settlement=pending)
"Pembayaran Berhasil" (settlement, capture)
"Pembayaran Gagal" (deny, expire, cancel, failed)
"Pembayaran Dikembalikan" (refund)
```

---

## SUPPORT & RESOURCES

### Midtrans Documentation
- API Docs: https://docs.midtrans.com/
- Snap.js Guide: https://docs.midtrans.com/snap/overview
- Webhook Guide: https://docs.midtrans.com/payment-link/webhook
- Test Credentials: https://docs.midtrans.com/test-payment

### Node.js Midtrans SDK
- GitHub: https://github.com/Midtrans/midtrans-nodejs-client
- NPM: https://www.npmjs.com/package/midtrans-client

### Community & Support
- Email: support@midtrans.com
- Dashboard Chat: https://dashboard.midtrans.com (Live chat support)

---

## VERSION HISTORY

```
v1.0.0 (2024-06-10)
- Initial production-ready release
- Full Midtrans integration
- Signature verification
- Atomic transactions
- Comprehensive logging
- Rate limiting
- Fraud detection hooks

v0.1.0 (2024-06-01)
- Initial MVP
- Basic Midtrans integration
- Simple webhook handler
```

---

**Last Updated:** 2024-06-10  
**Status:** Production Ready  
**Security Level:** ⭐⭐⭐⭐⭐
