const { body } = require('express-validator');

const validateOrder = [
  body('deliveryAddress.street').notEmpty().withMessage('Street address is required'),
  body('deliveryAddress.city').notEmpty().withMessage('City is required'),
  body('deliveryAddress.zipCode').notEmpty().withMessage('ZIP code is required'),
  body('contactInfo.name').notEmpty().withMessage('Name is required'),
  body('contactInfo.phone').matches(/^\d{10}$/).withMessage('Valid phone number is required'),
  body('deliveryTime').isISO8601().withMessage('Valid delivery time is required'),
  body('paymentMethod').isIn(['card', 'upi', 'cod', 'wallet']).withMessage('Valid payment method is required')
];

module.exports = {
  validateOrder
};