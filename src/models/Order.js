const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  customizations: [{
    optionName: String,
    choiceName: String,
    price: Number
  }],
  specialInstructions: String
});

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],
  deliveryAddress: {
    type: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    },
    required: true
  },
  contactInfo: {
    name: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    email: String
  },
  deliveryTime: {
    type: Date,
    required: true
  },
  deliveryInstructions: String,
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'on_the_way', 'delivered', 'cancelled'],
    default: 'pending'
  },
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String
  }],
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  driverLocation: {
    lat: Number,
    lng: Number,
    updatedAt: Date
  },
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative']
  },
  deliveryFee: {
    type: Number,
    default: 0,
    min: [0, 'Delivery fee cannot be negative']
  },
  tax: {
    type: Number,
    default: 0,
    min: [0, 'Tax cannot be negative']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  total: {
    type: Number,
    required: true,
    min: [0, 'Total cannot be negative']
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'upi', 'cod', 'wallet'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentId: String,
  promoCode: String,
  rating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  feedback: String,
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

// Generate order ID before saving
orderSchema.pre('save', async function(next) {
  if (!this.orderId) {
    const prefix = 'ORD';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.orderId = `${prefix}${timestamp}${random}`;
  }
  
  // Add initial status to history
  if (this.isNew) {
    this.statusHistory.push({
      status: this.status,
      note: 'Order placed'
    });
  }
  
  this.updatedAt = Date.now();
  next();
});

// Update status history when status changes
orderSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      note: 'Status updated'
    });
  }
  next();
});

// Calculate ETA based on status
orderSchema.methods.getETA = function() {
  const statusTimes = {
    pending: 5, // 5 minutes
    confirmed: 10,
    preparing: 15,
    on_the_way: 10
  };
  
  let totalMinutes = 0;
  for (const history of this.statusHistory) {
    totalMinutes += statusTimes[history.status] || 0;
  }
  
  return totalMinutes;
};

// Check if order is deliverable
orderSchema.methods.isDeliverable = function() {
  return this.status !== 'cancelled' && this.status !== 'delivered';
};

module.exports = mongoose.model('Order', orderSchema);