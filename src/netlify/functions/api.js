// netlify/functions/api.js
const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const router = express.Router();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB (for MongoDB Atlas)
const connectDB = async () => {
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('MongoDB connected');
    } catch (err) {
      console.error('MongoDB connection error:', err);
    }
  }
};

// Menu items data
const menuItems = [
  {
    id: 1,
    title: "Bolded Eggs",
    description: "Fresh eggs with special seasoning, perfectly boiled to perfection.",
    price: 12.99,
    category: "breakfast",
    rating: 4.5,
    prepTime: "15 min",
    popular: true,
    spicyLevel: 0,
    vegetarian: true
  },
  // ... add other menu items
];

// Routes
router.get('/', (req, res) => {
  res.json({ 
    message: 'Foody Zone API on Netlify',
    version: '1.0.0',
    endpoints: ['/menu', '/cart', '/orders']
  });
});

router.get('/menu', (req, res) => {
  const { category, search } = req.query;
  
  let filteredItems = [...menuItems];
  
  if (category && category !== 'all') {
    filteredItems = filteredItems.filter(item => 
      category === 'vegetarian' ? item.vegetarian :
      category === 'spicy' ? item.spicyLevel > 0 :
      item.category === category
    );
  }
  
  if (search) {
    filteredItems = filteredItems.filter(item =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  res.json({
    success: true,
    count: filteredItems.length,
    data: filteredItems
  });
});

router.get('/menu/categories', (req, res) => {
  const categories = [
    { id: 'all', name: 'All Items', icon: '🍽️' },
    { id: 'main', name: 'Main Course', icon: '🍛' },
    { id: 'breakfast', name: 'Breakfast', icon: '🥞' },
    { id: 'dessert', name: 'Desserts', icon: '🍰' },
    { id: 'beverage', name: 'Beverages', icon: '🥤' },
    { id: 'deal', name: 'Special Deals', icon: '🎯' },
    { id: 'vegetarian', name: 'Vegetarian', icon: '🥬' },
    { id: 'spicy', name: 'Spicy', icon: '🌶️' }
  ];
  
  res.json({ success: true, data: categories });
});

router.post('/cart', async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Items array is required'
      });
    }
    
    const subtotal = items.reduce((sum, item) => {
      const menuItem = menuItems.find(m => m.id === item.id);
      if (!menuItem) return sum;
      const price = menuItem.price === "SIS50" ? (menuItem.originalPrice || 0) / 2 : menuItem.price;
      return sum + (price * item.quantity);
    }, 0);
    
    const deliveryFee = subtotal > 25 ? 0 : 2.99;
    const tax = subtotal * 0.08;
    const total = subtotal + deliveryFee + tax;
    
    res.json({
      success: true,
      data: {
        items,
        subtotal: parseFloat(subtotal.toFixed(2)),
        deliveryFee: parseFloat(deliveryFee.toFixed(2)),
        tax: parseFloat(tax.toFixed(2)),
        total: parseFloat(total.toFixed(2))
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Connect to DB before handling requests
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

app.use('/.netlify/functions/api', router);
app.use('/api', router);

module.exports.handler = serverless(app);