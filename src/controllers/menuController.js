const Cart = require('../models/Cart');
const MenuItem = require('../models/MenuItem');
const { validationResult } = require('express-validator');

// @desc    Get user's cart
// @route   GET /api/v1/cart
// @access  Private
exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id })
      .populate('items.menuItem')
      .select('-user');

    if (!cart) {
      return res.status(200).json({
        success: true,
        message: 'Cart is empty',
        data: { items: [], total: 0, itemCount: 0 }
      });
    }

    const total = cart.calculateTotal();
    const itemCount = cart.getItemCount();

    res.status(200).json({
      success: true,
      data: {
        ...cart.toObject(),
        total,
        itemCount
      }
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching cart'
    });
  }
};

// @desc    Add item to cart
// @route   POST /api/v1/cart/add
// @access  Private
exports.addToCart = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { menuItemId, quantity = 1, customizations = [], specialInstructions } = req.body;

    // Check if menu item exists
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    // Check if item is available
    if (!menuItem.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'This item is currently unavailable'
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      cart = await Cart.create({ user: req.user.id, items: [] });
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.menuItem.toString() === menuItemId
    );

    if (existingItemIndex > -1) {
      // Update quantity and customizations
      cart.items[existingItemIndex].quantity += quantity;
      if (customizations.length > 0) {
        cart.items[existingItemIndex].customizations = customizations;
      }
      if (specialInstructions) {
        cart.items[existingItemIndex].specialInstructions = specialInstructions;
      }
    } else {
      // Add new item
      cart.items.push({
        menuItem: menuItemId,
        quantity,
        customizations,
        specialInstructions
      });
    }

    await cart.save();

    // Populate menu item details
    await cart.populate('items.menuItem');

    const total = cart.calculateTotal();
    const itemCount = cart.getItemCount();

    res.status(200).json({
      success: true,
      message: 'Item added to cart successfully',
      data: {
        ...cart.toObject(),
        total,
        itemCount
      }
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding item to cart'
    });
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/v1/cart/update/:itemId
// @access  Private
exports.updateCartItem = async (req, res) => {
  try {
    const { quantity, customizations, specialInstructions } = req.body;
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    // Find item index
    const itemIndex = cart.items.findIndex(
      item => item._id.toString() === itemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    // Update item
    if (quantity !== undefined) {
      if (quantity < 1) {
        // Remove item if quantity is 0 or less
        cart.items.splice(itemIndex, 1);
      } else {
        cart.items[itemIndex].quantity = quantity;
      }
    }

    if (customizations !== undefined) {
      cart.items[itemIndex].customizations = customizations;
    }

    if (specialInstructions !== undefined) {
      cart.items[itemIndex].specialInstructions = specialInstructions;
    }

    await cart.save();
    await cart.populate('items.menuItem');

    const total = cart.calculateTotal();
    const itemCount = cart.getItemCount();

    res.status(200).json({
      success: true,
      message: 'Cart updated successfully',
      data: {
        ...cart.toObject(),
        total,
        itemCount
      }
    });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating cart'
    });
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/v1/cart/remove/:itemId
// @access  Private
exports.removeFromCart = async (req, res) => {
  try {
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    // Remove item
    cart.items = cart.items.filter(item => item._id.toString() !== itemId);

    await cart.save();
    await cart.populate('items.menuItem');

    const total = cart.calculateTotal();
    const itemCount = cart.getItemCount();

    res.status(200).json({
      success: true,
      message: 'Item removed from cart successfully',
      data: {
        ...cart.toObject(),
        total,
        itemCount
      }
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing item from cart'
    });
  }
};

// @desc    Clear cart
// @route   DELETE /api/v1/cart/clear
// @access  Private
exports.clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = [];
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      data: { items: [], total: 0, itemCount: 0 }
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while clearing cart'
    });
  }
};

// @desc    Apply promo code
// @route   POST /api/v1/cart/apply-promo
// @access  Private
exports.applyPromoCode = async (req, res) => {
  try {
    const { promoCode } = req.body;

    // Mock promo codes - In production, store in database
    const validPromoCodes = {
      'WELCOME10': 10,
      'FOODY25': 25,
      'SIS50': 50
    };

    if (!validPromoCodes[promoCode.toUpperCase()]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid promo code'
      });
    }

    const discount = validPromoCodes[promoCode.toUpperCase()];

    res.status(200).json({
      success: true,
      message: 'Promo code applied successfully',
      data: { promoCode, discount }
    });
  } catch (error) {
    console.error('Apply promo error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while applying promo code'
    });
  }
};