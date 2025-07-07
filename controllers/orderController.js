const Order = require('../models/Order');

exports.cancelOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    // Update order status and restore inventory
    res.redirect(`/orders/${orderId}`);
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.requestReturn = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    // Validate mandatory reason and process return
    res.redirect(`/orders/${orderId}`);
  } catch (err) {
    res.status(500).send(err);
  }
};