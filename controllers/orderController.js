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

exports.getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.user._id;

    const order = await Order.findOne({ _id: orderId, userId }).populate('products.productId');

    if (!order) {
      return res.status(404).render('404', { message: 'Order not found' });
    }

    res.render('user/orderDetails', { order });
  } catch (err) {
    console.error('Order details error:', err);
    res.status(500).render('500', { message: 'Internal server error' });
  }
};