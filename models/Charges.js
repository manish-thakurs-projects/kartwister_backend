const mongoose = require('mongoose');

const ChargesSchema = new mongoose.Schema({
  shippingCharge: { type: Number, default: 0 },
  serviceCharge: { type: Number, default: 0 },
  transactionRate: { type: Number, default: 0 }, // percent or fixed, as needed
  tax: { type: Number, default: 0 }, // percent
}, { collection: 'charges' });

module.exports = mongoose.models.Charges || mongoose.model('Charges', ChargesSchema); 