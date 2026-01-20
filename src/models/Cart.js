const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
    default: 1
  },
  customizations: [{
    optionId: String,
    optionName: String,
    choiceId: String,
    choiceName: String,
    price: Number
  }],
  specialInstructions: String
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update updatedAt on save
cartSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Calculate total price
cartSchema.methods.calculateTotal = function() {
  let total = 0;
  
  for (const item of this.items) {
    const menuItem = item.menuItem;
    if (menuItem && typeof menuItem === 'object') {
      let itemPrice = menuItem.discountedPrice || menuItem.price;
      
      // Add customization prices
      if (item.customizations && item.customizations.length > 0) {
        item.customizations.forEach(custom => {
          itemPrice += custom.price || 0;
        });
      }
      
      total += itemPrice * item.quantity;
    }
  }
  
  return total;
};

// Get item count
cartSchema.methods.getItemCount = function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
};

module.exports = mongoose.model('Cart', cartSchema);