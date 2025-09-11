const Order = require('../models/Order');

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
    res.status(500).send("Something went wrong");
  }
};


exports.requestReturn = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    
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
    //console.log("order console",order);
    res.render('user/orderDetails', { order });
  } catch (err) {
    console.error('Order details error:', err);
    res.status(500).render('500', { message: 'Internal server error' });
  }
};