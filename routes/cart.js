const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const auth = require('../middleware/auth');
const { body } = require('express-validator');

router.get('/', auth, cartController.getCart);
router.post('/add',
  auth,
  [
    body('productId').optional().isMongoId(),
    body('name').isLength({ min: 1 }).trim().escape(),
    body('price').isFloat({ min: 0 }),
    body('image').isURL(),
    body('quantity').isInt({ min: 1 }),
    body('site').isLength({ min: 1 }).trim().escape(),
    body('url').isURL()
  ],
  cartController.addToCart
);
router.post('/remove',
  auth,
  [
    body('url').isURL()
  ],
  cartController.removeFromCart
);
router.post('/clear', auth, cartController.clearCart);

module.exports = router; 