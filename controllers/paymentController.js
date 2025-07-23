const razorpay = require('../config/razorpay');
const Order = require('../models/Order');


exports.initiatePayment = async (req, res) => {
  try {
    const { amount, receipt } = req.body;

    if (!amount) return res.status(400).json({ error: 'Missing amount' });

    const amountInPaise = Math.round(parseFloat(amount) * 100);
    console.log("Amount received (₹):", amount, "➡️ in paise:", amountInPaise);

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: receipt || 'receipt_' + Date.now(),
      payment_capture: 1
    };

    const razorpayOrder = await razorpay.orders.create(options);

    res.json({
      success: true,
      id: razorpayOrder.id,
      currency: razorpayOrder.currency,
      amount: razorpayOrder.amount
    });

  } catch (err) {
    console.error('Payment initiation failed:', err.message);
    res.status(500).json({ error: 'Payment initiation failed' });
  }
};


exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).send("Payment verification failed");
    }

    // ✅ Update Order in DB
    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id }).populate('products.product');

    if (!order) return res.status(404).send("Order not found");

    order.paymentStatus = 'Paid';
    order.status = 'Placed';
    order.razorpayPaymentId = razorpay_payment_id;
    await order.save();

    // ✅ Render success page
    res.render('user/payment-success', {
      paymentMethod: 'Razorpay',
      paymentVerified: true,
      orderId: order.orderId,
      orderItems: order.products,
      address: order.selectedAddress,
      totalAmount: order.totalAmount,
      deliveryCharge: order.deliveryCharge,
      estimatedDate: order.estimatedDelivery,
      checkoutUrl: '/user/checkout'
    });

  } catch (err) {
    console.error('Payment verification error:', err.message);
    res.status(500).send('Internal Server Error during verification');
  }
};

exports.paymentFailed = (req, res) => {
  const { orderId, error } = req.query;
  res.render('user/payment-failed', {
    orderId,
    error
  });
};
exports.paymentSuccess = (req, res) => {
  res.render('user/payment-success', {
    message: 'Payment was successful',
  });
};