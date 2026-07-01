const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

const CURRENCY = 'usd';
const MONGODB_URI = process.env.MONGODB_URI || '';

const PAYPAL_ENVIRONMENT = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';

const getPayPalBaseUrl = () => {
  return PAYPAL_ENVIRONMENT === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
};

const getPayPalAccessToken = async () => {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials are not configured in environment variables.');
  }
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const baseUrl = getPayPalBaseUrl();
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || 'Failed to retrieve PayPal access token');
  }
  return data.access_token;
};

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
    unitPrice: Number,
    size: String,
    color: String
  }],
  customer: {
    first_name: String,
    last_name: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    state: String,
    zip: String,
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
  image: { type: String },
  sizes: { type: [String], default: ['S', 'M', 'L', 'XL', '2XL'] },
  colors: { type: [String], default: ['Black', 'White'] }
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
app.get('/api/paypal/config', (req, res) => {
  res.json({ clientId: PAYPAL_CLIENT_ID });
});

app.post('/api/paypal/create-order', async (req, res) => {
  try {
    const { cart, customer } = req.body;
    if (!Array.isArray(cart) || cart.length === 0) throw new Error('Cart is empty');

    // Fetch fresh prices from DB
    const dbProducts = await Product.find({ active: true });
    const productMap = new Map(dbProducts.map(p => [p.name, p.price]));

    const finalItems = cart.map(item => {
      const dbPrice = productMap.get(item.name);
      if (dbPrice === undefined) throw new Error(`Unknown product: ${item.name}`);
      return {
        name: item.name,
        quantity: Number(item.quantity) || 1,
        unitPrice: dbPrice,
        size: item.size || '',
        color: item.color || ''
      };
    });

    const total = finalItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const amountStr = money(total);

    // Get PayPal token
    const accessToken = await getPayPalAccessToken();
    const baseUrl = getPayPalBaseUrl();

    // Create PayPal order
    const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: CURRENCY.toUpperCase(),
            value: amountStr
          },
          description: `Order for ${customer?.email || 'customer'}`
        }],
        application_context: {
          return_url: `${BASE_URL}/success.html`,
          cancel_url: `${BASE_URL}/`,
          brand_name: 'JMUNZ Merch Factory',
          landing_page: 'LOGIN',
          locale: 'en-US',
          user_action: 'PAY_NOW',
          shipping_preference: 'GET_FROM_FILE'
        }
      })
    });

    const paypalOrder = await response.json();
    if (!response.ok) {
      throw new Error(paypalOrder.message || 'Failed to create PayPal order');
    }

    // Create pending order in DB
    const order = await Order.create({
      orderId: paypalOrder.id,
      status: 'created',
      amount: amountStr,
      currency: CURRENCY.toUpperCase(),
      items: finalItems,
      customer: customer || {}
    });

    res.json({ id: paypalOrder.id, links: paypalOrder.links });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to create PayPal order' });
  }
});

app.post('/api/paypal/capture-order', async (req, res) => {
  const { paypalOrderId } = req.body;
  if (!paypalOrderId) return res.status(400).json({ error: 'PayPal Order ID is required' });

  try {
    const accessToken = await getPayPalAccessToken();
    const baseUrl = getPayPalBaseUrl();

    // Capture order
    const response = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const captureData = await response.json();
    if (!response.ok) {
      throw new Error(captureData.message || 'Failed to capture PayPal order');
    }

    if (captureData.status === 'COMPLETED') {
      const shippingDetails = captureData.purchase_units[0].shipping || {};
      const address = shippingDetails.address || {};
      const customerName = shippingDetails.name?.full_name || '';
      const nameParts = customerName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const updateData = {
        status: 'paid',
        paymentId: captureData.id,
        paidAmount: money(captureData.purchase_units[0].payments.captures[0].amount.value),
        paidCurrency: captureData.purchase_units[0].payments.captures[0].amount.currency_code,
        customer: {
          first_name: firstName,
          last_name: lastName,
          email: captureData.payer?.email_address || '',
          phone: captureData.payer?.phone?.phone_number?.national_number || '',
          address: address.address_line_1 || '',
          city: address.admin_area_2 || '',
          state: address.admin_area_1 || '',
          zip: address.postal_code || '',
          country: address.country_code || ''
        }
      };

      const order = await Order.findOneAndUpdate({ orderId: paypalOrderId }, updateData, { new: true });
      res.json({ success: true, order });
    } else {
      res.status(400).json({ error: `PayPal payment status is ${captureData.status}` });
    }
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to capture PayPal order' });
  }
});

// === STRIPE API ===
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const { cart, customer } = req.body;
    if (!Array.isArray(cart) || cart.length === 0) throw new Error('Cart is empty');

    // Fetch fresh prices from DB
    const dbProducts = await Product.find({ active: true });
    const productMap = new Map(dbProducts.map(p => [p.name, p.price]));

    const finalItems = cart.map(item => {
      const dbPrice = productMap.get(item.name);
      if (dbPrice === undefined) throw new Error(`Unknown product: ${item.name}`);
      return {
        name: item.name,
        quantity: Number(item.quantity) || 1,
        unitPrice: dbPrice,
        size: item.size || '',
        color: item.color || ''
      };
    });

    const total = finalItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const amountStr = money(total);
    const orderId = 'stripe_' + Math.random().toString(36).substring(2, 15);

    // Create pending order in DB
    const order = await Order.create({
      orderId: orderId,
      status: 'created',
      amount: amountStr,
      currency: CURRENCY.toUpperCase(),
      items: finalItems,
      customer: customer || {}
    });

    // Map to Stripe Line Items
    const lineItems = finalItems.map(item => ({
      price_data: {
        currency: CURRENCY,
        product_data: {
          name: `${item.name} (${item.size} / ${item.color})`,
        },
        unit_amount: Math.round(item.unitPrice * 100),
      },
      quantity: item.quantity,
    }));

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: customer?.email || undefined,
      client_reference_id: orderId,
      metadata: { orderId: orderId },
      success_url: `${BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Failed to create Stripe checkout session:', error);
    res.status(400).json({ error: error.message || 'Unable to create Stripe checkout session' });
  }
});

app.get('/api/stripe/checkout-success', async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: 'Session ID is required' });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const orderId = session.client_reference_id || session.metadata?.orderId;
    if (!orderId) throw new Error('Order reference not found in Stripe session.');

    if (session.payment_status === 'paid') {
      const updateData = {
        status: 'paid',
        paymentId: session.payment_intent || session.id,
        paidAmount: money(session.amount_total / 100),
        paidCurrency: session.currency?.toUpperCase()
      };

      const order = await Order.findOneAndUpdate({ orderId: orderId }, updateData, { new: true });
      if (!order) throw new Error('Order not found in database.');

      res.json({ success: true, order });
    } else {
      res.status(400).json({ error: `Stripe checkout session status is ${session.payment_status}` });
    }
  } catch (error) {
    console.error('Failed to verify Stripe checkout session:', error);
    res.status(400).json({ error: error.message || 'Unable to verify Stripe checkout session' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true, gateways: ['paypal', 'stripe'] }));

app.listen(PORT, () => {
  console.log(`JMUNZ store running at http://localhost:${PORT}`);
  if (!MONGODB_URI) console.warn('MongoDB URI is not configured yet.');
});
