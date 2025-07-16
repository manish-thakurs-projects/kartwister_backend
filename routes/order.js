const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const auth = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { body } = require('express-validator');

router.post('/place',
  auth,
  [
    // No body fields required, order is placed from user's cart
  ],
  orderController.placeOrder
);
router.post('/place-with-proof', auth, upload.single('paymentProof'), orderController.placeOrderWithProof);
router.post('/repay/:orderId', auth, upload.single('paymentProof'), orderController.repayOrder);
router.get('/', auth, orderController.getOrders);
router.get('/:id', auth, orderController.getOrder);
router.get('/:id/track', auth, orderController.trackOrder);

module.exports = router; 