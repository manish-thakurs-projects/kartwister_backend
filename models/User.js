const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: String,
  price: Number,
  image: String,
  quantity: { type: Number, default: 1 },
  site: String,
  url: String
}, { _id: false });

const ScrapeRequestSchema = new mongoose.Schema({
  url: String,
  site: String,
  name: String,
  date: { type: Date, default: Date.now }
}, { _id: false });

const AddressSchema = new mongoose.Schema({
  label: { type: String, required: true }, // e.g., Home, Office, etc.
  name: { type: String, required: true },
  phone: { type: String, required: true },
  addressLine1: { type: String, required: true },
  addressLine2: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  country: { type: String, required: true },
  postalCode: { type: String, required: true },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  isDefault: { type: Boolean, default: false }
}, { _id: true });

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  otp: { type: String },
  cart: [CartItemSchema],
  cartSubtotal: { type: Number, default: 0 },
  orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  isAdmin: { type: Boolean, default: false },
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  scrapeRequests: [ScrapeRequestSchema],
  addresses: [AddressSchema]
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema); 