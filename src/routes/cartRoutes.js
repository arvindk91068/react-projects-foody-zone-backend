const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const auth = require('../middleware/auth');

// Protected routes
router.get('/', auth, cartController.getCart);
router.post('/add', auth, cartController.addToCart);
router.put('/update/:itemId', auth, cartController.updateCartItem);
router.delete('/remove/:itemId', auth, cartController.removeFromCart);
router.delete('/clear', auth, cartController.clearCart);
router.post('/apply-promo', auth, cartController.applyPromoCode);

module.exports = router;