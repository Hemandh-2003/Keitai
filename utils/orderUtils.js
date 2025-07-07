const shortid = require('shortid');
const Order = require('../models/Order');

exports.generateOrderId = async () => {
  let orderId;
  let isUnique = false;
  
  while (!isUnique) {
    orderId = shortid.generate();
    const existingOrder = await Order.findOne({ orderId });
    if (!existingOrder) isUnique = true;
  }
  
  return orderId;
};