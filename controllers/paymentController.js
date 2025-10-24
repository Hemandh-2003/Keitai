const razorpay = require('../config/razorpay');
const Order = require('../models/Order');
const crypto = require('crypto');
const {HTTP_STATUS}= require('../SM/status');
const { MESSAGE }= require('../SM/messages');

exports.initiatePayment = async (req, res) => {
  try {
    const { amount, receipt } = req.body;

    if (!amount) return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Missing amount' });

    const amountInPaise = Math.round(parseFloat(amount) * 100);
    //console.log("Amount received (₹):", amount, "➡️ in paise:", amountInPaise);//Debug

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
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Payment initiation failed' });
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
      return res.status(HTTP_STATUS.BAD_REQUEST).send("Payment verification failed");
    }

    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id }).populate('products.product');

    if (!order) return res.status(HTTP_STATUS.NOT_FOUND).send(MESSAGE.ORDER_NOT_FOUND);

    order.paymentStatus = 'Paid';
    order.status = 'Placed';
    order.razorpayPaymentId = razorpay_payment_id;
    await order.save();

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
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Internal Server Error during verification');
  }
};

exports.paymentFailed = async (req, res) => {
    try {
        const orderId = req.session?.checkout?.orderId;
        
        if (!orderId) {
            return res.redirect('/user/orders');
        }

        // Update order status
        await Order.findByIdAndUpdate(orderId, {
            status: 'Payment Failed',
            paymentStatus: 'Failed'
        });

        // Clear checkout session
        delete req.session.checkout;
        
        // Direct redirect to order details page with retry payment option
        return res.redirect(`/user/order-details/${orderId}`);
    } catch (err) {
        console.error('Payment failure error:', err);
        res.status(500).json({ error: 'Payment processing failed. Please try again.' });
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
  const razorpayOrderId = req.params.orderId;

  try {
    if (!razorpayOrderId) return res.redirect('/user/orders');

    // If the param is a Razorpay order id (starts with "order_") look up the DB order
    let order = null;
    if (String(razorpayOrderId).startsWith('order_')) {
      order = await Order.findOne({ razorpayOrderId }).select('_id');
    } else {
      // fallback: param might already be a DB _id
      try {
        order = await Order.findById(razorpayOrderId).select('_id');
      } catch (e) {
        // invalid ObjectId — ignore and try to find by razorpayOrderId again
        order = await Order.findOne({ razorpayOrderId }).select('_id');
      }
    }

    if (!order) {
      // Nothing found — send user back to orders list
      return res.redirect('/user/orders');
    }

    // Redirect to the user-facing order details page (DB _id)
    return res.redirect(`/user/order-details/${order._id}`);
  } catch (err) {
    console.error('Error in retryPayment:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(MESSAGE.SOMETHING_WENT_WRONG || 'Internal Server Error');
  }
};
exports.retryPaymentFromOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const user = req.session.user;
        
        if (!user) {
            return res.redirect('/login');
        }

        const order = await Order.findOne({ 
            _id: orderId, 
            user: user._id 
        }).populate('products.product');
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Set up checkout session for retry
        req.session.checkout = {
            orderId: order._id.toString(),
            totalAmount: order.totalAmount,
            productIds: order.products.map(p => p.product._id.toString()),
            quantities: order.products.map(p => p.quantity),
            addressId: order.selectedAddress?._id || null,
            paymentMethod: 'Razorpay',
            isRetry: true
        };

        await req.session.save();
        res.redirect('/user/checkout');
    } catch (err) {
        console.error('Retry payment error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};