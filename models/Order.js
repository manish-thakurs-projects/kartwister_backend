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

const TrackingStepSchema = new mongoose.Schema({
  status: String,
  date: { type: Date, default: Date.now },
  note: String
}, { _id: false });

const DeliveryAddressSchema = new mongoose.Schema({
  label: String,
  name: String,
  phone: String,
  addressLine1: String,
  addressLine2: String,
  city: String,
  state: String,
  country: String,
  postalCode: String,
  location: {
    lat: Number,
    lng: Number
  },
  isDefault: Boolean
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  products: [CartItemSchema],
  status: { type: String, default: 'pending' }, // pending, paid, fulfilled, etc.
  paymentStatus: { type: String, default: 'unpaid' }, // unpaid, paid, approved
  paymentProof: { type: String }, // URL or filename for QR/payment proof
  shippingCharge: { type: Number, default: 0 },
  serviceCharge: { type: Number, default: 0 },
  deliveryAddress: DeliveryAddressSchema,
  tracking: [TrackingStepSchema],
  completed: { type: Boolean, default: false },
  repaidFor: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  needsRecheck: { type: Boolean, default: false },
  subtotal: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema); 