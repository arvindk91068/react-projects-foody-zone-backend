const Order = require('../models/Order');
const Cart = require('../models/Cart');
const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const { validationResult } = require('express-validator');
const sendEmail = require('../utils/email');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// @desc    Create new order
// @route   POST /api/v1/orders
// @access  Private
exports.createOrder = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      deliveryAddress,
      contactInfo,
      deliveryTime,
      deliveryInstructions,
      paymentMethod,
      promoCode
    } = req.body;

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user.id })
      .populate('items.menuItem');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // Calculate order details
    const items = cart.items.map(item => ({
      menuItem: item.menuItem._id,
      name: item.menuItem.title,
      quantity: item.quantity,
      price: item.menuItem.discountedPrice || item.menuItem.price,
      customizations: item.customizations,
      specialInstructions: item.specialInstructions
    }));

    // Calculate subtotal
    let subtotal = 0;
    items.forEach(item => {
      let itemPrice = item.price;
      if (item.customizations && item.customizations.length > 0) {
        item.customizations.forEach(custom => {
          itemPrice += custom.price || 0;
        });
      }
      subtotal += itemPrice * item.quantity;
    });

    // Calculate delivery fee (free above $25)
    const deliveryFee = subtotal > 25 ? 0 : 2.99;

    // Calculate tax (8%)
    const tax = subtotal * 0.08;

    // Apply promo discount if any
    let discount = 0;
    let discountAmount = 0;
    if (promoCode) {
      const validPromoCodes = {
        'WELCOME10': 10,
        'FOODY25': 25,
        'SIS50': 50
      };
      discount = validPromoCodes[promoCode.toUpperCase()] || 0;
      discountAmount = (subtotal * discount) / 100;
    }

    // Calculate total
    const total = subtotal + deliveryFee + tax - discountAmount;

    // Create order
    const order = await Order.create({
      user: req.user.id,
      items,
      deliveryAddress,
      contactInfo,
      deliveryTime: new Date(deliveryTime),
      deliveryInstructions,
      paymentMethod,
      promoCode,
      subtotal,
      deliveryFee,
      tax,
      discount: discountAmount,
      total
    });

    // Clear user's cart
    cart.items = [];
    await cart.save();

    // Send order confirmation email
    try {
      const user = await User.findById(req.user.id);
      
      const emailMessage = `
        <h2>Thank you for your order!</h2>
        <p>Your order #${order.orderId} has been confirmed.</p>
        <h3>Order Details:</h3>
        <ul>
          ${items.map(item => `<li>${item.name} x ${item.quantity} - $${(item.price * item.quantity).toFixed(2)}</li>`).join('')}
        </ul>
        <p><strong>Subtotal:</strong> $${subtotal.toFixed(2)}</p>
        <p><strong>Delivery Fee:</strong> $${deliveryFee.toFixed(2)}</p>
        <p><strong>Tax:</strong> $${tax.toFixed(2)}</p>
        <p><strong>Discount:</strong> $${discountAmount.toFixed(2)}</p>
        <p><strong>Total:</strong> $${total.toFixed(2)}</p>
        <p><strong>Delivery Address:</strong> ${deliveryAddress.street}, ${deliveryAddress.city}</p>
        <p><strong>Estimated Delivery:</strong> ${new Date(deliveryTime).toLocaleTimeString()}</p>
      `;

      await sendEmail({
        email: user.email,
        subject: `Order Confirmation #${order.orderId}`,
        html: emailMessage
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the order if email fails
    }

    // Emit real-time update via Socket.IO
    const io = req.app.get('io');
    io.to(`order-${order._id}`).emit('order-created', order);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating order'
    });
  }
};

// @desc    Get user's orders
// @route   GET /api/v1/orders
// @access  Private
exports.getUserOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { user: req.user.id };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('items.menuItem', 'title image');

    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      data: orders
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching orders'
    });
  }
};

// @desc    Get single order
// @route   GET /api/v1/orders/:id
// @access  Private
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.menuItem')
      .populate('driver', 'name phone');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns the order or is admin
    if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this order'
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching order'
    });
  }
};

// @desc    Update order status
// @route   PUT /api/v1/orders/:id/status
// @access  Private/Admin
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update status
    order.status = status;
    if (note) {
      order.statusHistory.push({
        status,
        note
      });
    }

    await order.save();

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`order-${order._id}`).emit('order-status-updated', {
      orderId: order._id,
      status,
      timestamp: new Date()
    });

    // Notify user if order is delivered
    if (status === 'delivered') {
      try {
        const user = await User.findById(order.user);
        await sendEmail({
          email: user.email,
          subject: 'Your Order Has Been Delivered!',
          html: `
            <h2>Your order has been delivered!</h2>
            <p>Order #${order.orderId} has been successfully delivered.</p>
            <p>We hope you enjoy your meal! Please rate your experience.</p>
          `
        });
      } catch (emailError) {
        console.error('Failed to send delivery email:', emailError);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating order status'
    });
  }
};

// @desc    Cancel order
// @route   PUT /api/v1/orders/:id/cancel
// @access  Private
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns the order
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order'
      });
    }

    // Check if order can be cancelled
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage'
      });
    }

    // Update status
    order.status = 'cancelled';
    order.statusHistory.push({
      status: 'cancelled',
      note: 'Cancelled by user'
    });

    await order.save();

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`order-${order._id}`).emit('order-cancelled', order._id);

    // Process refund if payment was made
    if (order.paymentStatus === 'paid') {
      // In production, integrate with Stripe/Payment Gateway
      // await processRefund(order);
    }

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling order'
    });
  }
};

// @desc    Rate order
// @route   POST /api/v1/orders/:id/rate
// @access  Private
exports.rateOrder = async (req, res) => {
  try {
    const { rating, feedback } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns the order
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to rate this order'
      });
    }

    // Check if order is delivered
    if (order.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Can only rate delivered orders'
      });
    }

    // Check if already rated
    if (order.rating) {
      return res.status(400).json({
        success: false,
        message: 'Order already rated'
      });
    }

    // Update rating
    order.rating = rating;
    order.feedback = feedback;
    await order.save();

    // Update menu item ratings
    for (const item of order.items) {
      const menuItem = await MenuItem.findById(item.menuItem);
      if (menuItem) {
        const newRatingsCount = menuItem.ratingsCount + 1;
        const newRating = ((menuItem.rating * menuItem.ratingsCount) + rating) / newRatingsCount;
        
        menuItem.rating = Math.round(newRating * 10) / 10;
        menuItem.ratingsCount = newRatingsCount;
        
        await menuItem.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Order rated successfully',
      data: order
    });
  } catch (error) {
    console.error('Rate order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while rating order'
    });
  }
};

// @desc    Get all orders (Admin)
// @route   GET /api/v1/orders/admin/all
// @access  Private/Admin
exports.getAllOrders = async (req, res) => {
  try {
    const { status, startDate, endDate, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('user', 'name email')
      .populate('driver', 'name phone');

    const total = await Order.countDocuments(query);
    const totalRevenue = await Order.aggregate([
      { $match: { status: 'delivered' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      totalRevenue: totalRevenue[0]?.total || 0,
      data: orders
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching orders'
    });
  }
};