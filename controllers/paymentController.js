const razorpay = require('../config/razorpay');
const Order = require('../models/Order');
const crypto = require('crypto');
const {HTTP_STATUS}= require('../SM/status');

exports.initiatePayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId });

    if (!order || isNaN(order.totalAmount)) {
      console.error('❌ Invalid order or total amount:', order?.totalAmount);
      return res.status(400).send('Invalid order');
    }

    const amountInPaise = Math.round(parseFloat(order.totalAmount) * 100);

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: order.orderId,
    };

   // console.log("📦 Razorpay Options:", options);

    const razorpayOrder = await razorpay.orders.create(options);
    

    order.paymentMethod = 'Online';
    order.razorpayOrderId = razorpayOrder.id;
    order.amount=razorpayOrder.amount;
    await order.save();
    //console.log(razorpayOrder)

    res.json({
      id: razorpayOrder.id,
      currency: razorpayOrder.currency,
      amount: razorpayOrder.amount,
      order_id: order.orderId
    });

  } catch (err) {
    console.error('❌ Razorpay creation failed:', err.message || err);
    res.status(500).send('Payment initiation failed');
  }
};


exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });

    if (!order) {
      return res.status(400).send('Invalid Order ID');
    }

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).send('Payment verification failed');
    }

    order.paymentStatus = 'Paid';
    order.razorpayPaymentId = razorpay_payment_id;
    order.status = 'Pending'; 
    await order.save();

    res.redirect(`/payment/success/${order.orderId}`);
  } catch (err) {
    console.error(err);
    res.redirect('/payment/failed');
  }
};

exports.paymentFailed = async (req, res) => {
  try {
    const { error } = req.query;
    const orderId = req.session.checkout.orderId;

    if (!req.session.user) {
      return res.redirect('/login');
    }

    // ✅ Update order status
    if (orderId) {
      await Order.findByIdAndUpdate(orderId, {
        status: 'Payment Failed'
      });
    }

    // res.render('user/payment-failed', {
    //   orderId,
    //   error,
    //   user: req.session.user
    // });
    res.redirect(`/user/order/${orderId}`);

  } catch (err) {
    console.error('Payment failure handling error:', err.message);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Internal Server Error during payment failure handling');
  }
};

exports.renderRetryPaymentPage = (req, res) => {
  const { orderId } = req.body;
  res.render('user/payment-failed', {
    orderId,
    error: 'Please retry your payment.',
    user: req.session.user
  })
}


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
  const { orderId } = req.params;

  try {
    res.redirect(`/checkout?orderId=${orderId}`);
  } catch (err) {
    console.error('Error in retryPayment:', err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Something went wrong');
  }
};
exports.retryPaymentFromOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const user = req.session.user;

    if (!user) {
      return res.redirect('/login');
    }

    const order = await Order.findOne({ _id: orderId, user: user._id }).populate('products.product');

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).send('Order not found');
    }

    if (order.status !== 'Payment Failed' && order.status !== 'Pending') {
      return res.status(HTTP_STATUS.BAD_REQUEST).send('Payment retry is not allowed for this order');
    }

    req.session.retryOrder = {
      orderId: order._id,
      products: order.products.map(p => ({
        product: p.product._id.toString(),
        quantity: p.quantity
      })),
      addressId: order.selectedAddress,
      coupon: order.coupon,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod
    };

    res.redirect('/user/checkout');

  } catch (err) {
    console.error('Error in retryPaymentFromOrder:', err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Server error during payment retry');
  }
};
