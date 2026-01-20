const express = require('express');
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.json());

const menuItems = [
  {
    id: 1,
    title: "Bolded Eggs",
    description: "Fresh eggs with special seasoning, perfectly boiled to perfection.",
    price: 12.99,
    category: "breakfast",
    rating: 4.5,
    prepTime: "15 min",
    popular: true
  },
  {
    id: 2,
    title: "RAMEN",
    description: "Authentic Japanese ramen with rich broth and fresh noodles.",
    price: 14.99,
    category: "main",
    rating: 4.8,
    prepTime: "20 min",
    popular: true
  }
];

app.get('/', (req, res) => {
  res.json({ message: 'Foody Zone API' });
});

app.get('/api/menu', (req, res) => {
  res.json({ success: true, data: menuItems });
});

app.post('/api/orders', (req, res) => {
  const { items } = req.body;
  const orderId = 'ORD' + Date.now();
  
  res.json({
    success: true,
    message: 'Order placed!',
    orderId,
    items
  });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});