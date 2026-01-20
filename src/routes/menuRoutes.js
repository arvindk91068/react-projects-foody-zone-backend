const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Public routes
router.get('/', menuController.getMenuItems);
router.get('/categories', menuController.getCategories);
router.get('/:id', menuController.getMenuItem);

// Protected routes
router.post('/:id/rate', auth, menuController.rateMenuItem);

// Admin routes
router.post('/', auth, admin, menuController.createMenuItem);
router.put('/:id', auth, admin, menuController.updateMenuItem);
router.delete('/:id', auth, admin, menuController.deleteMenuItem);

module.exports = router;