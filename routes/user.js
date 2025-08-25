const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const { body } = require('express-validator');

router.get('/profile', auth, userController.getProfile);
router.get('/dashboard', auth, userController.getDashboard);

// Address management
router.get('/addresses', auth, userController.getAddresses);
router.post('/addresses', auth, userController.addAddress);
router.put('/addresses/:id', auth, userController.updateAddress);
router.delete('/addresses/:id', auth, userController.deleteAddress);
router.patch('/addresses/:id/select', auth, userController.selectAddress);

module.exports = router; 