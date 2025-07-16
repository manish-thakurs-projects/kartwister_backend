const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { body } = require('express-validator');

router.post('/register',
  [
    body('name').isLength({ min: 2 }).trim().escape(),
    body('email').isEmail().normalizeEmail(),
    body('phone').isMobilePhone().isLength({ min: 10, max: 15 }),
    body('password').isLength({ min: 8 })
  ],
  authController.register
);
router.post('/verify-otp', authController.verifyOtp);
router.post('/login',
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().isMobilePhone().isLength({ min: 10, max: 15 }),
    body('password').isLength({ min: 8 })
  ],
  authController.login
);
router.post('/forgot-password',
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().isMobilePhone().isLength({ min: 10, max: 15 })
  ],
  authController.forgotPassword
);
router.post('/reset-password',
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().isMobilePhone().isLength({ min: 10, max: 15 }),
    body('otp').isLength({ min: 6, max: 6 }),
    body('newPassword').isLength({ min: 8 })
  ],
  authController.resetPassword
);

module.exports = router; 