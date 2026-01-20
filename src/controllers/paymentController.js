const Order = require('../models/Order');
const Payment = require('../models/Payment');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// @desc    Create payment intent
// @route   POST /api/v1/payment/create-intent
// @access  Private
exports.createPaymentIntent = async (req, res) => {
  try {
    const { orderId, paymentMethod } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order belongs to user
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Check if order is already paid
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Order already paid'
      });
    }

    // For COD, just update payment status
    if (paymentMethod === 'cod') {
      order.paymentStatus = 'pending';
      order.paymentMethod = 'cod';
      await order.save();

      return res.status(200).json({
        success: true,
        message: 'COD payment registered',
        data: { paymentMethod: 'cod', status: 'pending' }
      });
    }

    // For card payments, create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.total * 100), // Convert to cents/paisa
      currency: 'inr',
      payment_method_types: ['card'],
      metadata: {
        orderId: order.orderId,
        userId: req.user.id.toString()
      }
    });

    // Create payment record
    const payment = await Payment.create({
      order: order._id,
      user: req.user.id,
      amount: order.total,
      currency: 'INR',
      paymentMethod: 'card',
      paymentId: paymentIntent.id,
      status: 'pending',
      metadata: {
        stripeClientSecret: paymentIntent.client_secret,
        stripePaymentIntentId: paymentIntent.id
      }
    });

    res.status(200).json({
      success: true,
      message: 'Payment intent created',
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentId: payment._id
      }
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating payment intent'
    });
  }
};

// @desc    Confirm payment
// @route   POST /api/v1/payment/confirm
// @access  Private
exports.confirmPayment = async (req, res) => {
  try {
    const { paymentId, paymentIntentId } = req.body;

    const payment = await Payment.findById(paymentId)
      .populate('order');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if payment belongs to user
    if (payment.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      // Update payment status
      payment.status = 'completed';
      payment.paymentDetails = {
        cardLast4: paymentIntent.charges.data[0]?.payment_method_details?.card?.last4,
        cardBrand: paymentIntent.charges.data[0]?.payment_method_details?.card?.brand
      };
      await payment.save();

      // Update order payment status
      const order = await Order.findById(payment.order._id);
      order.paymentStatus = 'paid';
      order.paymentId = paymentIntent.id;
      await order.save();

      // Emit payment success event
      const io = req.app.get('io');
      io.to(`order-${order._id}`).emit('payment-success', {
        orderId: order._id,
        paymentId: payment._id
      });

      res.status(200).json({
        success: true,
        message: 'Payment confirmed successfully',
        data: { orderId: order._id, paymentStatus: 'paid' }
      });
    } else {
      // Payment failed
      payment.status = 'failed';
      await payment.save();

      res.status(400).json({
        success: false,
        message: 'Payment failed',
        data: { paymentStatus: 'failed' }
      });
    }
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while confirming payment'
    });
  }
};

// @desc    Get payment status
// @route   GET /api/v1/payment/status/:orderId
// @access  Private
exports.getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const payment = await Payment.findOne({ order: orderId })
      .populate('order');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found for this order'
      });
    }

    // Check if payment belongs to user or is admin
    if (payment.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payment status'
    });
  }
};

// @desc    Process refund
// @route   POST /api/v1/payment/refund
// @access  Private/Admin
exports.processRefund = async (req, res) => {
  try {
    const { orderId, reason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order is eligible for refund
    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Order not paid'
      });
    }

    const payment = await Payment.findOne({ order: orderId });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    // Process refund via Stripe
    const refund = await stripe.refunds.create({
      payment_intent: payment.paymentId,
      amount: Math.round(order.total * 100),
      reason: 'requested_by_customer'
    });

    // Update payment and order
    payment.status = 'refunded';
    payment.refundAmount = order.total;
    payment.refundReason = reason;
    await payment.save();

    order.paymentStatus = 'refunded';
    await order.save();

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        refundId: refund.id,
        amount: order.total,
        status: refund.status
      }
    });
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing refund'
    });
  }
};

// @desc    Webhook for Stripe events
// @route   POST /api/v1/payment/webhook
// @access  Public
exports.stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('PaymentIntent was successful:', paymentIntent.id);
      
      // Update payment status in database
      await handlePaymentSuccess(paymentIntent.id);
      break;

    case 'payment_intent.payment_failed':
      const failedPaymentIntent = event.data.object;
      console.log('PaymentIntent failed:', failedPaymentIntent.id);
      
      // Update payment status in database
      await handlePaymentFailure(failedPaymentIntent.id);
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};

// Helper functions
async function handlePaymentSuccess(paymentIntentId) {
  try {
    const payment = await Payment.findOne({ paymentId: paymentIntentId });
    if (payment) {
      payment.status = 'completed';
      await payment.save();

      const order = await Order.findById(payment.order);
      if (order) {
        order.paymentStatus = 'paid';
        await order.save();
      }
    }
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

async function handlePaymentFailure(paymentIntentId) {
  try {
    const payment = await Payment.findOne({ paymentId: paymentIntentId });
    if (payment) {
      payment.status = 'failed';
      await payment.save();

      const order = await Order.findById(payment.order);
      if (order) {
        order.paymentStatus = 'failed';
        await order.save();
      }
    }
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}