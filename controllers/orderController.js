const Order = require('../models/Order');
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
    const userId = req.session.user && req.session.user._id;

    if (!userId) {
      return res.redirect('/user/login');
    }

    const order = await Order.findOne({ _id: orderId, userId }).populate('products.productId');

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).render('404', { message: MESSAGE.ORDER_NOT_FOUND });
    }

    res.render('user/orderDetails', { order });
  } catch (err) {
    console.error('Order details error:', err);
    // Avoid rendering a missing 500 view — send a plain 500 response
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(MESSAGE.INTERNAL_SERVER_ERROR);
  }
};