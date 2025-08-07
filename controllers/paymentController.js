const razorpay = require('../config/razorpay');
const Order = require('../models/Order');
const crypto = require('crypto');

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
  if (!req.session.user) {
    return res.redirect('/login');
  }
  
  const { orderId, error } = req.query;
  const user = req.session.user;

  res.render('user/payment-failed', {
    orderId,
    error,
    user
  });
};

exports.paymentSuccess = (req, res) => {
  res.render('user/payment-success', {
    message: 'Payment was successful',
  });
};

const Razorpay = require('razorpay');
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
exports.retryPayment = async (req, res) => {
  try {
    console.log('Retry payment initiated by user:', req.session.user?._id);
    
    if (!req.session.user) {
      console.error('No user session found');
      return res.status(401).json({ 
        error: 'Authentication required',
        details: 'User not logged in'
      });
    }

    const userId = req.session.user._id;
    console.log('Looking for failed orders for user:', userId);

    const lastOrder = await Order.findOne({
      user: userId,
      paymentStatus: { $in: ['failed', 'pending'] } // Check both statuses
    }).sort({ createdAt: -1 });

    if (!lastOrder) {
      console.error('No failed/pending order found for user:', userId);
      return res.status(404).json({ 
        error: 'No order found',
        details: 'No failed or pending order available for retry'
      });
    }

    console.log('Found order for retry:', lastOrder._id);

    // Use totalAmount if available, otherwise fallback to totalPrice
    const orderAmount = lastOrder.totalAmount || lastOrder.totalPrice;
    
    if (!orderAmount || isNaN(orderAmount)) {
      console.error('Invalid order amount:', orderAmount);
      return res.status(400).json({
        error: 'Invalid amount',
        details: `Order amount is invalid: ${orderAmount}`
      });
    }

    const retryAmount = Math.round(parseFloat(orderAmount) * 100);
    console.log('Creating Razorpay order for amount:', retryAmount);

    const razorpayOrder = await razorpay.orders.create({
      amount: retryAmount,
      currency: 'INR',
      receipt: `retry_${lastOrder._id}_${Date.now()}`,
      notes: {
        orderId: lastOrder._id.toString(),
        retryAttempt: Date.now()
      }
    });

    console.log('Razorpay order created:', razorpayOrder.id);

    // Update the order with new Razorpay ID
    lastOrder.razorpayOrderId = razorpayOrder.id;
    lastOrder.paymentRetryAttempts = (lastOrder.paymentRetryAttempts || 0) + 1;
    await lastOrder.save();

    console.log('Order updated with new Razorpay ID');

    return res.json({
      key: process.env.RAZORPAY_KEY_ID,
      order: razorpayOrder,
      user: {
        name: req.session.user.name,
        email: req.session.user.email
      }
    });

  } catch (err) {
    console.error('Full retry payment error:', err);
    
    // Specific error for Razorpay API failures
    if (err.error && err.error.description) {
      return res.status(500).json({
        error: 'Payment gateway error',
        details: err.error.description,
        code: err.error.code
      });
    }

    return res.status(500).json({ 
      error: 'Retry payment failed',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};