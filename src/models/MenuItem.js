const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide item title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please provide item description'],
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  price: {
    type: Number,
    required: [true, 'Please provide item price'],
    min: [0, 'Price cannot be negative']
  },
  originalPrice: {
    type: Number,
    min: [0, 'Original price cannot be negative']
  },
  discount: {
    type: Number,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100%']
  },
  category: {
    type: String,
    required: [true, 'Please provide item category'],
    enum: ['breakfast', 'main', 'dessert', 'beverage', 'deal', 'snack']
  },
  subcategory: {
    type: String,
    enum: ['veg', 'non-veg', 'vegan', 'spicy', 'healthy']
  },
  rating: {
    type: Number,
    default: 0,
    min: [0, 'Rating cannot be less than 0'],
    max: [5, 'Rating cannot be more than 5']
  },
  ratingsCount: {
    type: Number,
    default: 0
  },
  prepTime: {
    type: Number,
    required: [true, 'Please provide preparation time'],
    min: [1, 'Preparation time must be at least 1 minute']
  },
  calories: Number,
  ingredients: [String],
  dietaryInfo: [{
    type: String,
    enum: ['gluten-free', 'dairy-free', 'nut-free', 'soy-free', 'egg-free']
  }],
  spicyLevel: {
    type: Number,
    min: [0, 'Spicy level cannot be negative'],
    max: [5, 'Spicy level cannot exceed 5'],
    default: 0
  },
  isVegetarian: {
    type: Boolean,
    default: false
  },
  isVegan: {
    type: Boolean,
    default: false
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  image: {
    type: String,
    default: 'https://res.cloudinary.com/demo/image/upload/v1691234567/food-placeholder.jpg'
  },
  customizationOptions: [{
    name: String,
    required: Boolean,
    multiple: Boolean,
    choices: [{
      name: String,
      price: Number
    }]
  }],
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for discounted price
menuItemSchema.virtual('discountedPrice').get(function() {
  if (this.discount && this.discount > 0) {
    return this.price * (1 - this.discount / 100);
  }
  return this.price;
});

// Update updatedAt on save
menuItemSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Text index for search
menuItemSchema.index({ title: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('MenuItem', menuItemSchema);