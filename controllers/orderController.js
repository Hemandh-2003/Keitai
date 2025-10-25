const Order = require('../models/Order');
const User = require('../models/User');
const { MESSAGE } = require('../SM/messages');
const {HTTP_STATUS}= require('../SM/status');

exports.cancelOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;

    const order = await Order.findById(orderId).populate("user");
    if (!order) {
      req.flash("error", "Order not found");
      return res.redirect("/user/orders");
    }

    for (let item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity }
      });
    }

    order.status = "Cancelled";
    order.cancellationReason = reason || "User cancelled";
    await order.save();

    if (order.paymentMethod !== "COD" && order.paymentStatus === "Paid") {
      order.user.wallet += order.totalAmount;
      await order.user.save();
      req.flash("success", "Order cancelled and amount refunded to wallet.");
    } else {
      req.flash("success", "Order cancelled successfully.");
    }

    res.redirect(`/orders/${orderId}`);
  } catch (err) {
    console.error("Cancel order error:", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(MESSAGE.SOMETHING_WENT_WRONG);
  }
};


exports.requestReturn = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    res.redirect(`/orders/${orderId}`);
  } catch (err) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(err);
  }
};

exports.getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.user && String(req.session.user._id);

    if (!userId) {
      return res.redirect('/user/login');
    }

    // Load order without assuming the exact user field name or product ref name
    const order = await Order.findById(orderId)
      .populate([
        { path: 'products.productId' },
        { path: 'products.product' }
      ]);

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).render('404', { message: MESSAGE.ORDER_NOT_FOUND });
    }

    // Determine owner id from possible fields
    const ownerId = order.user ? String(order.user) : (order.userId ? String(order.userId) : null);

    if (!ownerId || ownerId !== userId) {
      // Not the owner — protect details
      return res.status(HTTP_STATUS.FORBIDDEN).send('You are not authorized to view this order.');
    }

    // Get user data for Razorpay prefill
    const user = await User.findById(userId);
    
    return res.render('user/orderDetails', { 
      order,
      user: user,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Order details error:', err && err.stack ? err.stack : err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(MESSAGE.INTERNAL_SERVER_ERROR);
  }
};