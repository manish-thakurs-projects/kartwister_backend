const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  image: String,
  site: String,
  url: { type: String, unique: true },
  lastScraped: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema); 