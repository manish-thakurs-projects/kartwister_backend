const express = require('express');
const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend is running' });
});

router.use('/auth', require('./auth'));
router.use('/scrape', require('./scrape'));
router.use('/cart', require('./cart'));
router.use('/order', require('./order'));
router.use('/user', require('./user'));
router.use('/admin', require('./admin'));

module.exports = router; 