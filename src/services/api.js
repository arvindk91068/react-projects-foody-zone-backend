import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const menuAPI = {
  getMenuItems: async (category = 'all', search = '') => {
    const response = await API.get('/menu', {
      params: { category, search }
    });
    return response.data;
  },
  
  getCategories: async () => {
    const response = await API.get('/menu/categories');
    return response.data;
  }
};

export const cartAPI = {
  calculateCart: async (items) => {
    const response = await API.post('/cart', { items });
    return response.data;
  }
};

export const orderAPI = {
  placeOrder: async (orderData) => {
    const response = await API.post('/orders', orderData);
    return response.data;
  }
};

export const promoAPI = {
  checkPromo: async (promoCode) => {
    const response = await API.post('/check-promo', { promoCode });
    return response.data;
  }
};

export default API;