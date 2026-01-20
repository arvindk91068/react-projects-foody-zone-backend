const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Protected routes
router.post('/', auth, orderController.createOrder);
router.get('/', auth, orderController.getUserOrders);
router.get('/:id', auth, orderController.getOrder);
router.put('/:id/cancel', auth, orderController.cancelOrder);
router.post('/:id/rate', auth, orderController.rateOrder);

// Admin routes
router.get('/admin/all', auth, admin, orderController.getAllOrders);
router.put('/:id/status', auth, admin, orderController.updateOrderStatus);

module.exports = router;