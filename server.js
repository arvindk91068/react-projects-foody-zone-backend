// server.js (for local development only)
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
const connectDB = async () => {
  try {
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ MongoDB connected');
    }
  } catch (error) {
    console.log('⚠️  MongoDB connection failed');
  }
};

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Foody Zone API (Local Development)',
    version: '1.0.0',
    note: 'For Netlify deployment, use netlify/functions/api.js'
  });
});

// Start server for local development
const startServer = async () => {
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Local: http://localhost:${PORT}`);
    console.log(`📋 For Netlify: Run 'npm run netlify'`);
  });
};

if (require.main === module) {
  startServer();
}