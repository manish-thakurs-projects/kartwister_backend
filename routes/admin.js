const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const multer = require('multer');

// Admin middleware
function isAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    console.warn(`Admin access denied: IP=${req.ip}, userId=${req.user ? req.user.userId : 'none'}, endpoint=${req.originalUrl}`);
    return res.status(403).json({ message: 'Admin only' });
  }
  next();
}

const upload = multer({ dest: 'uploads/' });

router.get('/orders', auth, isAdmin, adminController.getAllOrders);
router.patch('/order/:id/status', auth, isAdmin, adminController.updateOrderStatus);
router.post('/order/:id/approve-payment', auth, isAdmin, adminController.approvePayment);
router.post('/order/:id/verify-payment', auth, isAdmin, adminController.verifyOrderPayment);
router.post('/order/:id/complete-delivery', auth, adminController.completeDelivery);
router.post('/order/:id/reject-payment', auth, isAdmin, adminController.rejectPayment);
router.post('/upload-qr', auth, isAdmin, upload.single('qr'), adminController.uploadQR);
router.get('/scrape-requests', auth, isAdmin, adminController.getAllScrapeRequests);
router.get('/current-qr', auth, isAdmin, adminController.getCurrentQR);
router.get('/completed-orders', auth, adminController.getCompletedOrders);
const chargesController = require('../controllers/adminController');
const userAuth = require('../middleware/auth');
router.get('/public-charges', userAuth, chargesController.getCharges); // Authenticated users can fetch charges
// POST /admin/charges expects { shippingCharge, serviceCharge, transactionRate }
router.post('/charges', auth, isAdmin, adminController.setCharges);
router.get('/public-qr', userAuth, adminController.getCurrentQR); // Authenticated users can fetch QR
router.get('/users', auth, adminController.getAllUsers);
router.post('/email', auth, adminController.sendEmail);
router.post('/bulk-email', auth, adminController.sendBulkEmail);
router.get('/charges', auth, isAdmin, adminController.getCharges);
router.get('/emails', auth, isAdmin, adminController.getAdminEmails);
router.post('/emails', auth, isAdmin, adminController.addAdminEmail);
router.delete('/emails', auth, isAdmin, adminController.removeAdminEmail);

module.exports = router; 