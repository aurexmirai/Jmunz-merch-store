const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

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

const Product = mongoose.model('Product', productSchema);
const Setting = mongoose.model('Setting', settingSchema);

const products = [
  { id: 'p1', name: 'Shehht Munz (EM)', price: 19.99, category: 'tee', description: 'Embroidered tee · 11 colors', image: 'assets/product_01.jpg', order: 1 },
  { id: 'p2', name: 'Munz Thirteen Hoodie', price: 39.99, category: 'hoodie', description: 'Heavyweight hoodie · Unisex', image: 'assets/product_02.jpg', order: 2 },
  { id: 'p3', name: 'BIG SHEHHT Hoodie', price: 39.99, category: 'hoodie', description: 'Heavyweight hoodie · Unisex', image: 'assets/product_03.jpg', order: 3 },
  { id: 'p4', name: 'Chill Munz Hoodie', price: 39.99, category: 'hoodie', description: 'Heavyweight hoodie · 12 colors', image: 'assets/product_04.jpg', order: 4 },
  { id: 'p5', name: '13 Hoodie', price: 39.99, category: 'hoodie', description: 'Heavyweight hoodie · 12 colors', image: 'assets/product_05.jpg', order: 5 },
  { id: 'p6', name: 'Laughing Munz (EM)', price: 19.99, category: 'tee', description: 'Embroidered tee · 11 colors', image: 'assets/product_06.jpg', order: 6 },
  { id: 'p7', name: 'SHEHHT Hoodie', price: 39.99, category: 'hoodie', description: 'Heavyweight hoodie · Unisex', image: 'assets/product_07.jpg', order: 7 }
];

const initialSettings = {
  key: 'global',
  storeName: 'JMUNZ MERCH FACTORY',
  heroTitle: 'THE JMUNZ\nMERCH FACTORY',
  heroSubtitle: 'Where every reaction, inside joke and community moment becomes something you can wear.',
  youtubeUrl: 'https://www.youtube.com/@jmunz13',
  officialStoreUrl: 'https://jmunz13-shop.fourthwall.com/',
  currency: 'USD'
};

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected! Seeding database...');

    await Product.deleteMany({});
    await Product.insertMany(products);
    console.log('Inserted 7 products.');

    await Setting.findOneAndUpdate({ key: 'global' }, initialSettings, { upsert: true });
    console.log('Inserted initial settings.');

    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();
