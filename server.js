const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_ENVIRONMENT = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
const PAYPAL_BASE_URL = PAYPAL_ENVIRONMENT === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
const MONGODB_URI = process.env.MONGODB_URI || '';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// MongoDB Connection
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB successfully'))
    .catch(err => console.error('Failed to connect to MongoDB', err));
} else {
  console.warn('MONGODB_URI is not configured in .env. Database connection skipped.');
}

// Schemas
const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  status: { type: String, required: true, default: 'created' },
  amount: { type: String, required: true },
  currency: { type: String, required: true },
  items: [{
    name: String,
    quantity: Number,
    unitPrice: Number
  }],
  customer: {
    first_name: String,
    last_name: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    country: String
  },
  paymentId: String,
  paidAmount: String,
  paidCurrency: String
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String },
  description: { type: String },
  productUrl: { type: String },
  order: { type: Number, default: 1 },
  active: { type: Boolean, default: true },
  featured: { type: Boolean, default: true },
  soldOut: { type: Boolean, default: false },
  image: { type: String }
});

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  storeName: String,
  heroTitle: String,
  heroSubtitle: String,
  shopTitle: String,
  shopDescription: String,
  currency: String,
  youtubeUrl: String,
  officialStoreUrl: String
});

const Order = mongoose.model('Order', orderSchema);
const Product = mongoose.model('Product', productSchema);
const Setting = mongoose.model('Setting', settingSchema);

// Admin Auth Middleware
const requireAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

function money(value) { return Number(value).toFixed(2); }

async function generatePayPalAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials'
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || 'Failed to generate PayPal access token');
  return data.access_token;
}

app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// === ADMIN API ===
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate({ orderId: req.params.id }, { status: req.body.status }, { new: true });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  try {
    const p = await Product.create(req.body);
    res.json(p);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const p = await Product.findOneAndUpdate({ id: req.params.id }, req.body, { new: true, upsert: true });
    res.json(p);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    await Product.findOneAndDelete({ id: req.params.id });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const s = await Setting.findOneAndUpdate({ key: 'global' }, { ...req.body, key: 'global' }, { new: true, upsert: true });
    res.json(s);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === PUBLIC API ===
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({ active: true }).sort({ order: 1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const s = await Setting.findOne({ key: 'global' });
    res.json(s || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === PAYPAL API ===
app.post('/api/paypal/create-order', async (req, res) => {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      return res.status(503).json({ error: 'PayPal is not configured. Add your Client ID and Secret to .env.' });
    }
    if (!MONGODB_URI) {
      return res.status(503).json({ error: 'MongoDB is not configured. Add your MONGODB_URI to .env.' });
    }

    const { cart, customer } = req.body;
    if (!Array.isArray(cart) || cart.length === 0) throw new Error('Cart is empty');
    
    // Fetch fresh prices from DB
    const dbProducts = await Product.find({ active: true });
    const productMap = new Map(dbProducts.map(p => [p.name, p.price]));
    
    const items = cart.map(item => {
      const dbPrice = productMap.get(item.name);
      if (dbPrice === undefined) throw new Error(`Unknown product: ${item.name}`);
      return {
        name: item.name,
        quantity: 1, // Storefront sends individual items in cart array
        unitPrice: dbPrice
      };
    });

    // Group items for PayPal format
    const grouped = new Map();
    for (const item of items) {
      grouped.set(item.name, {
        name: item.name,
        quantity: (grouped.get(item.name)?.quantity || 0) + 1,
        unitPrice: item.unitPrice
      });
    }
    const finalItems = [...grouped.values()];

    const total = finalItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    
    // Get setting for currency
    const settings = await Setting.findOne({ key: 'global' });
    const currency = settings?.currency || CURRENCY;
    const formattedAmount = money(total);

    const accessToken = await generatePayPalAccessToken();
    const payload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: formattedAmount,
            breakdown: {
              item_total: {
                currency_code: currency,
                value: formattedAmount
              }
            }
          },
          items: finalItems.map(item => ({
            name: item.name,
            unit_amount: {
              currency_code: currency,
              value: money(item.unitPrice)
            },
            quantity: String(item.quantity)
          }))
        }
      ]
    };

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to create PayPal order');

    await Order.create({
      orderId: data.id,
      status: 'created',
      amount: formattedAmount,
      currency,
      items: finalItems,
      customer: customer || {}
    });

    res.json({ id: data.id });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to create payment' });
  }
});

app.post('/api/paypal/capture-order', async (req, res) => {
  const { orderID } = req.body;
  if (!orderID) return res.status(400).json({ error: 'Order ID is required' });

  try {
    const accessToken = await generatePayPalAccessToken();
    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    const data = await response.json();
    
    // Update local order
    const updateData = {
      status: data.status === 'COMPLETED' ? 'paid' : data.status.toLowerCase(),
      paymentId: data.id
    };

    if (data.status === 'COMPLETED') {
        const capture = data.purchase_units[0].payments.captures[0];
        updateData.paidAmount = capture.amount.value;
        updateData.paidCurrency = capture.amount.currency_code;
    }

    await Order.findOneAndUpdate({ orderId: orderID }, updateData, { new: true, upsert: true });

    if (!response.ok) throw new Error(data.message || 'Failed to capture PayPal order');
    
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to capture payment' });
  }
});

app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({
      orderId: order.orderId,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      updatedAt: order.updatedAt
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

app.get('/api/paypal/client-id', (req, res) => {
    res.json({ clientId: PAYPAL_CLIENT_ID });
});

app.get('/health', (_req, res) => res.json({ ok: true, environment: PAYPAL_ENVIRONMENT }));

app.listen(PORT, () => {
  console.log(`JMUNZ store running at http://localhost:${PORT}`);
  console.log(`PayPal mode: ${PAYPAL_ENVIRONMENT.toUpperCase()}`);
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) console.warn('PayPal credentials are not configured yet.');
  if (!MONGODB_URI) console.warn('MongoDB URI is not configured yet.');
});
