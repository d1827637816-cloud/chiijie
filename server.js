require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const snap = require('midtrans-client').Snap;

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'webtokobajuu',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Midtrans Snap client
const snapClient = new snap({
  isProduction: process.env.NODE_ENV === 'production' || false,
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'YOUR_SERVER_KEY',
  clientKey: process.env.MIDTRANS_CLIENT_KEY || 'YOUR_CLIENT_KEY'
});

const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(express.static(PUBLIC_DIR));
app.use(express.static(__dirname));

// Image upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, file.fieldname + '-' + unique + ext);
  }
});

const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

// =============== IMAGE UPLOAD ===============
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const urlPath = '/uploads/' + req.file.filename;
  res.json({ url: urlPath });
});

// =============== SHIPPING COSTS API ===============
app.get('/api/shipping-costs', async (req, res) => {
  try {
    const { province, city } = req.query;
    const connection = await pool.getConnection();

    let query = 'SELECT * FROM shipping_costs WHERE active = TRUE';
    const params = [];

    if (province && city) {
      query += ' AND province = ? AND city = ?';
      params.push(province, city);
    } else if (province) {
      query += ' AND province = ?';
      params.push(province);
    } else if (city) {
      query += ' AND city = ?';
      params.push(city);
    }

    const [results] = await connection.execute(query, params);
    connection.release();

    res.json(results);
  } catch (error) {
    console.error('Shipping costs error:', error);
    res.status(500).json({ error: 'Failed to fetch shipping costs' });
  }
});

// Get all provinces
app.get('/api/provinces', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [results] = await connection.execute(
      'SELECT DISTINCT province FROM shipping_costs WHERE active = TRUE ORDER BY province'
    );
    connection.release();
    const provinces = results.map(r => r.province);
    res.json(provinces);
  } catch (error) {
    console.error('Provinces error:', error);
    res.status(500).json({ error: 'Failed to fetch provinces' });
  }
});

// Get cities by province
app.get('/api/cities/:province', async (req, res) => {
  try {
    const { province } = req.params;
    const connection = await pool.getConnection();
    const [results] = await connection.execute(
      'SELECT DISTINCT city FROM shipping_costs WHERE province = ? AND active = TRUE ORDER BY city',
      [province]
    );
    connection.release();
    const cities = results.map(r => r.city);
    res.json(cities);
  } catch (error) {
    console.error('Cities error:', error);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

// Vendor partners list
app.get('/api/vendors', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [results] = await connection.execute(
      'SELECT id, name, platform, description, store_url AS storeUrl, logo, categories FROM vendor_partners WHERE active = TRUE ORDER BY name'
    );
    connection.release();
    res.json(results);
  } catch (error) {
    console.error('Vendors error:', error);
    res.status(500).json({ error: 'Failed to fetch vendor partners' });
  }
});

app.post('/api/merchants/apply', async (req, res) => {
  try {
    const { name, platform, storeUrl, email, phone, categories, description } = req.body;
    if (!name || !platform || !storeUrl || !email) {
      return res.status(400).json({ error: 'Nama toko, platform, URL toko, dan email wajib diisi' });
    }

    const connection = await pool.getConnection();
    await connection.execute(
      'INSERT INTO merchant_applications (shop_name, platform, store_url, email, phone, categories, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, platform, storeUrl, email, phone, categories, description]
    );
    connection.release();

    res.json({ success: true });
  } catch (error) {
    console.error('Merchant application error:', error);
    res.status(500).json({ error: 'Gagal menyimpan aplikasi merchant' });
  }
});

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'LUXEM Marketplace Search/1.0' } }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function fetchDummyMarketplaceSearch(query) {
  try {
    const external = await fetchJson(`https://dummyjson.com/products/search?q=${encodeURIComponent(query)}`);
    if (!external || !Array.isArray(external.products)) return [];
    return external.products.slice(0, 8).map(item => ({
      id: 'market-' + item.id,
      name: item.title,
      brand: item.brand || item.category || 'Marketplace Partner',
      price: item.price || 0,
      img: item.thumbnail || '',
      cat: item.category || 'Marketplace Partner',
      source: 'Dummy Marketplace',
      sourceUrl: `https://dummyjson.com/products/${item.id}`
    }));
  } catch (error) {
    console.error('Dummy marketplace search error:', error);
    return [];
  }
}

async function fetchTokopediaSearch(query) {
  if (!process.env.TOKOPEDIA_API_KEY) return [];
  try {
    const url = `https://api.tokopedia.com/v1/search?keyword=${encodeURIComponent(query)}`;
    const external = await fetchJson(url);
    if (!external || !Array.isArray(external.data)) return [];
    return external.data.slice(0, 6).map(item => ({
      id: 'tokopedia-' + item.id,
      name: item.name || item.title,
      brand: item.store_name || 'Tokopedia Partner',
      price: item.price || 0,
      img: item.image_url || '',
      cat: item.category || 'Tokopedia',
      source: 'Tokopedia',
      sourceUrl: item.url || item.product_url || 'https://www.tokopedia.com'
    }));
  } catch (error) {
    console.error('Tokopedia search error:', error);
    return [];
  }
}

async function fetchShopeeSearch(query) {
  if (!process.env.SHOPEE_API_KEY) return [];
  try {
    const url = `https://partner.shopeemobile.com/api/v2/search_items?keyword=${encodeURIComponent(query)}`;
    const external = await fetchJson(url);
    if (!external || !Array.isArray(external.items)) return [];
    return external.items.slice(0, 6).map(item => ({
      id: 'shopee-' + item.itemid,
      name: item.name || item.item_name,
      brand: item.shop_name || 'Shopee Partner',
      price: item.price || 0,
      img: item.image || '',
      cat: item.category || 'Shopee',
      source: 'Shopee',
      sourceUrl: item.url || 'https://shopee.co.id'
    }));
  } catch (error) {
    console.error('Shopee search error:', error);
    return [];
  }
}

async function fetchMarketplaceSearch(query) {
  const results = [];
  const dummy = await fetchDummyMarketplaceSearch(query);
  results.push(...dummy);

  if (process.env.TOKOPEDIA_API_KEY) {
    const tokopedia = await fetchTokopediaSearch(query);
    results.push(...tokopedia);
  }

  if (process.env.SHOPEE_API_KEY) {
    const shopee = await fetchShopeeSearch(query);
    results.push(...shopee);
  }

  return results.slice(0, 20);
}

// Search local products + marketplace partners
app.get('/api/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ local: [], marketplace: [] });

    const like = '%' + q + '%';
    const connection = await pool.getConnection();
    const [localResults] = await connection.execute(
      'SELECT id, name, brand, price, img, category AS cat FROM products WHERE name LIKE ? OR brand LIKE ? OR category LIKE ? LIMIT 20',
      [like, like, like]
    );
    connection.release();

    const marketplaceResults = await fetchMarketplaceSearch(q);
    res.json({ local: localResults, marketplace: marketplaceResults });
  } catch (error) {
    console.error('Search API error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// =============== PAYMENT API ===============

// Get payment configuration for client integration
app.get('/api/payment/config', (req, res) => {
  const snapUrl = process.env.NODE_ENV === 'production'
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';

  res.json({
    clientKey: process.env.MIDTRANS_CLIENT_KEY || 'YOUR_CLIENT_KEY',
    snapUrl: process.env.MIDTRANS_SNAP_URL || snapUrl
  });
});

// Create payment transaction & get Snap token
app.post('/api/payment/create-token', async (req, res) => {
  try {
    const { orderId, amount, customerEmail, customerName, customerPhone, paymentMethod } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({ error: 'Order ID and amount are required' });
    }

    const selectedMethod = paymentMethod || 'bank_transfer_bca';
    const transactionId = 'TRX-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const connection = await pool.getConnection();

    // Create transaction record
    await connection.execute(
      'INSERT INTO payment_transactions (id, order_id, amount, payment_method, status) VALUES (?, ?, ?, ?, ?)',
      [transactionId, orderId, amount, selectedMethod, 'pending']
    );

    // Build Midtrans Snap parameters for the selected method
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
        finish: process.env.PAYMENT_REDIRECT_URL || 'http://localhost:3000/payment-status.html?status=success',
        error: process.env.PAYMENT_REDIRECT_URL || 'http://localhost:3000/payment-status.html?status=error',
        unfinish: process.env.PAYMENT_REDIRECT_URL || 'http://localhost:3000/payment-status.html?status=unfinish'
      }
    };

    let enabledPayments = ['bank_transfer', 'gopay', 'qris', 'ovo', 'dana', 'shopeepay'];
    const paymentOverrides = {};

    switch (selectedMethod) {
      case 'bank_transfer_bca':
        enabledPayments = ['bank_transfer'];
        paymentOverrides.bank_transfer = { bank: 'bca' };
        break;
      case 'bank_transfer_mandiri':
        enabledPayments = ['bank_transfer'];
        paymentOverrides.bank_transfer = { bank: 'mandiri' };
        break;
      case 'gopay':
        enabledPayments = ['gopay'];
        break;
      case 'ovo':
        enabledPayments = ['ovo'];
        break;
      case 'dana':
        enabledPayments = ['dana'];
        break;
      case 'qris':
        enabledPayments = ['qris'];
        break;
      default:
        enabledPayments = ['bank_transfer', 'gopay', 'qris', 'ovo', 'dana', 'shopeepay'];
        break;
    }

    parameter.enabled_payments = enabledPayments;
    Object.assign(parameter, paymentOverrides);

    // Get Snap token from Midtrans
    const snapToken = await snapClient.createTransaction(parameter);

    // Update transaction with snap token
    await connection.execute(
      'UPDATE payment_transactions SET snap_token = ? WHERE id = ?',
      [snapToken.token, transactionId]
    );

    connection.release();

    res.json({
      success: true,
      snapToken: snapToken.token,
      transactionId: transactionId,
      redirectUrl: snapToken.redirect_url
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({ error: 'Failed to create payment token', details: error.message });
  }
});

// Payment notification callback from Midtrans
app.post('/api/payment/notification', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const notification = req.body;
    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const transactionId = notification.transaction_id;

    let paymentStatus = 'pending';
    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      paymentStatus = 'paid';
    } else if (transactionStatus === 'deny' || transactionStatus === 'cancel' || transactionStatus === 'expire') {
      paymentStatus = 'failed';
    }

    // Update payment transaction
    await connection.execute(
      'UPDATE payment_transactions SET status = ?, transaction_id = ?, updated_at = NOW() WHERE order_id = ?',
      [paymentStatus, transactionId, orderId]
    );

    // Update order status if paid
    if (paymentStatus === 'paid') {
      await connection.execute(
        'UPDATE orders SET status_index = 1, last_updated = NOW() WHERE id = ?',
        [orderId]
      );
    }

    connection.release();
    res.json({ success: true });
  } catch (error) {
    console.error('Payment notification error:', error);
    res.status(500).json({ error: 'Notification processing failed' });
  }
});

// Check payment status
app.get('/api/payment/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const connection = await pool.getConnection();
    const [results] = await connection.execute(
      'SELECT * FROM payment_transactions WHERE order_id = ? ORDER BY created_at DESC LIMIT 1',
      [orderId]
    );
    connection.release();

    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ error: 'Payment not found' });
    }
  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({ error: 'Failed to fetch payment status' });
  }
});

// =============== ORDER API ===============

// Create order
app.post('/api/orders/create', async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, address, city, province,
      shippingMethod, paymentMethod, cart, subtotal, shippingCost, discount
    } = req.body;

    if (!firstName || !email || !address || !city || !province || !cart || cart.length === 0 || !paymentMethod) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Insert or get customer
      let [customers] = await connection.execute(
        'SELECT id FROM customers WHERE email = ?',
        [email]
      );

      let customerId;
      if (customers.length > 0) {
        customerId = customers[0].id;
      } else {
        const [result] = await connection.execute(
          'INSERT INTO customers (first_name, last_name, email, phone, address, city, province) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [firstName, lastName, email, phone, address, city, province]
        );
        customerId = result.insertId;
      }

      // Create order
      const orderId = 'LXM-' + String(Date.now()).slice(-8) + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
      const total = subtotal + shippingCost - discount;

      await connection.execute(
        'INSERT INTO orders (id, customer_id, shipping_method, payment_method, subtotal, shipping_cost, discount, total, status_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [orderId, customerId, shippingMethod, paymentMethod, subtotal, shippingCost, discount, total, 0]
      );

      // Insert order items
      for (const item of cart) {
        await connection.execute(
          'INSERT INTO order_items (order_id, product_id, name, brand, price, quantity) VALUES (?, ?, ?, ?, ?, ?)',
          [orderId, item.id || 'unknown', item.name, item.brand, item.price, item.quantity]
        );
      }

      // Insert initial status
      await connection.execute(
        'INSERT INTO order_status_history (order_id, step, status, location) VALUES (?, ?, ?, ?)',
        [orderId, 0, 'Menunggu Pembayaran', 'Dashboard Pelanggan']
      );

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        orderId: orderId,
        total: total,
        customerId: customerId
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
});

// Get order details
app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const connection = await pool.getConnection();

    const [orders] = await connection.execute(
      'SELECT o.*, c.first_name, c.last_name, c.email, c.phone, c.address, c.city, c.province FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.id = ?',
      [orderId]
    );

    if (orders.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Order not found' });
    }

    const [items] = await connection.execute(
      'SELECT * FROM order_items WHERE order_id = ?',
      [orderId]
    );

    const [status] = await connection.execute(
      'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY updated_at DESC',
      [orderId]
    );

    connection.release();

    res.json({
      order: orders[0],
      items: items,
      status: status
    });
  } catch (error) {
    console.error('Order fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LUXE.M Server running on http://localhost:${PORT}`);
  console.log(`Midtrans Mode: ${process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX'}`);
});
