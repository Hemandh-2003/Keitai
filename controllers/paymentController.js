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

// exports.paymentFailed = async (req, res) => {
//     try {
//       const orderId = req.query.orderId || req.session?.pendingOrderData?.orderId;
        
//         if (!orderId) {
//             return res.redirect('/user/orders');
//         }

//         // Update order status
//         await Order.findByIdAndUpdate(orderId, {
//             status: 'Payment Failed',
//             paymentStatus: 'Failed'
//         });

//         // Clear checkout session
//         delete req.session.checkout;
        
//         // Direct redirect to order details page with retry payment option
//         return res.redirect(`/user/order-details/${orderId}`);
//     } catch (err) {
//         console.error('Payment failure error:', err);
//         res.status(500).json({ error: 'Payment processing failed. Please try again.' });
//     }
// };

exports.paymentFailed = async (req, res) => {
  try {
    const orderId = req.query.orderId || req.session?.pendingOrderData?.orderId;

    if (!orderId) {
      console.warn('⚠️ No orderId found during payment failure redirect.');
      return res.redirect('/user/orders');
    }

    // Update order to reflect failure
    await Order.findByIdAndUpdate(orderId, {
      status: 'Payment Failed',
      paymentStatus: 'Failed',
      updatedAt: new Date(),
    });

    // Clean up sessions
    delete req.session.checkout;
    delete req.session.pendingOrderData;

    console.log(`❌ Payment marked as failed for Order: ${orderId}`);

    // Redirect user to order details page with retry option
    return res.redirect(`/user/order/${orderId}`);
  } catch (err) {
    console.error('Payment failure error:', err);
    res.status(500).json({ error: 'Payment processing failed. Please try again.' });
  }
};

exports.renderRetryPaymentPage = (req, res) => {
  const { orderId } = req.body;
  res.render('user/checkout', {
    orderId,
    error: 'Please retry your payment.',
    user: req.session.user
  })
}
exports.setupRetryPayment = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Validate order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Save retry info in session for checkout
    req.session.retryOrderId = orderId;
    req.session.checkout = null; // Clear old checkout if any

    console.log(`🔁 Retry payment initialized for order: ${orderId}`);

    // Respond with redirect URL
    return res.json({
      success: true,
      redirectUrl: '/user/checkout',
      message: 'Retry payment session prepared.'
    });

  } catch (error) {
    console.error('Retry payment setup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to initialize retry payment. Please try again.'
    });
  }
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
    return res.redirect(`/user/order/${order._id}`);
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

        // Check if order is eligible for retry
        if (order.status !== 'Payment Failed' && order.paymentStatus !== 'Failed') {
            return res.status(400).json({ error: 'Order is not eligible for retry' });
        }

        // For AJAX requests, return JSON with payment setup
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            // Set up session for retry payment
            req.session.checkout = {
                productIds: order.products.map(p => p.product._id.toString()),
                quantities: order.products.map(p => p.quantity),
                offerPrices: order.products.map(p => p.unitPrice || p.price),
                totalAmount: order.totalAmount,
                orderId: order._id.toString(),
                selectedAddress: order.selectedAddress?.toString(),
                isRetry: true,
                retryOrderId: order._id.toString()
            };

            // Clear any existing pending order data
            delete req.session.pendingOrderData;
            delete req.session.coupon;

            await req.session.save();

            return res.json({
                success: true,
                orderId: order._id,
                totalAmount: order.totalAmount,
                message: 'Ready for retry payment'
            });
        }

        // For regular requests, redirect to order details
        res.redirect(`/user/order/${orderId}`);
    } catch (err) {
        console.error('Retry payment error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};