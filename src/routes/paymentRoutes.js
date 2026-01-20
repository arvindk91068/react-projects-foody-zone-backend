const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Protected routes
router.post('/create-intent', auth, paymentController.createPaymentIntent);
router.post('/confirm', auth, paymentController.confirmPayment);
router.get('/status/:orderId', auth, paymentController.getPaymentStatus);

// Admin routes
router.post('/refund', auth, admin, paymentController.processRefund);

// Webhook (public - no auth needed)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.stripeWebhook);

module.exports = router;