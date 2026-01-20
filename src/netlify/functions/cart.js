exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  
  const { items } = JSON.parse(event.body);
  
  // Calculate total
  const total = items.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0);
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      subtotal: total,
      deliveryFee: total > 25 ? 0 : 2.99,
      tax: total * 0.08,
      total: total + (total > 25 ? 0 : 2.99) + (total * 0.08)
    })
  };
};