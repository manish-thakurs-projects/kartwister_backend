const User = require('../models/User');
const { validationResult } = require('express-validator');
const Product = require('../models/Product');
const Charges = require('../models/Charges');

function calculateCartSubtotal(cart, charges) {
  const productsTotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  const taxAmount = (charges.tax || 0) > 0 ? (productsTotal * (charges.tax / 100)) : 0;
  return productsTotal + (charges.shippingCharge || 0) + (charges.serviceCharge || 0) + taxAmount;
}

exports.getCart = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ cart: user.cart || [], cartSubtotal: user.cartSubtotal || 0 });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.addToCart = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid input', errors: errors.array() });
  console.log('Add to cart request body:', req.body);
  try {
    const user = await User.findById(req.user.userId);
    console.log('User found for add to cart:', user ? user.email : null);
    if (!user) return res.status(404).json({ message: 'User not found' });
    let { productId, name, price, image, quantity, site, url } = req.body;
    // Fetch price from Product model if missing or zero
    if (!price || price === 0) {
      let product = null;
      if (productId) {
        product = await Product.findById(productId);
      } else if (url) {
        product = await Product.findOne({ url });
      }
      if (product) {
        price = product.price;
        if (!name) name = product.name;
        if (!image) image = product.image;
        if (!site) site = product.site;
      }
    }
    const existing = user.cart.find(item => item.url === url);
    if (existing) {
      existing.quantity += quantity || 1;
    } else {
      user.cart.push({ productId, name, price, image, quantity: quantity || 1, site, url });
    }
    // Calculate and save cart subtotal
    const charges = await Charges.findOne({}) || { shippingCharge: 0, serviceCharge: 0, transactionRate: 0, tax: 0 };
    user.cartSubtotal = calculateCartSubtotal(user.cart, charges);
    await user.save();
    res.json(user.cart);
  } catch (err) {
    console.error('Add to cart error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.removeFromCart = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid input', errors: errors.array() });
  const { url } = req.body;
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.cart = user.cart.filter(item => item.url !== url);
    // Calculate and save cart subtotal
    const charges = await Charges.findOne({}) || { shippingCharge: 0, serviceCharge: 0, transactionRate: 0, tax: 0 };
    user.cartSubtotal = calculateCartSubtotal(user.cart, charges);
    await user.save();
    res.json(user.cart);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.cart = [];
    user.cartSubtotal = 0;
    await user.save();
    res.json({ message: 'Cart cleared' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}; 