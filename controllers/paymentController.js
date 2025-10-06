const razorpay = require('../config/razorpay');
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const crypto = require('crypto');
const { HTTP_STATUS } = require('../SM/status');

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

    // Validate required fields
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Missing payment verification data'
      });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.error('Payment signature verification failed');
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Payment verification failed - Invalid signature"
      });
    }

    // Find order by razorpayOrderId
    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id })
      .populate('products.product')
      .populate('selectedAddress');

    if (!order) {
      console.error('Order not found for Razorpay ID:', razorpay_order_id);
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "Order not found"
      });
    }

    // Update order status
    order.paymentStatus = 'paid';
    order.status = 'Placed';
    order.razorpayPaymentId = razorpay_payment_id;
    order.paidAt = new Date();
    await order.save();

    // Clear cart and session data
    if (req.session.checkout) {
      delete req.session.checkout;
    }
    if (req.session.retryOrderId) {
      delete req.session.retryOrderId;
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
      orderId: order._id
    });

  } catch (err) {
    console.error('Payment verification error:', err.message);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal Server Error during verification'
    });
  }
};

exports.paymentFailed = async (req, res) => {
  try {
    const { orderId, error } = req.query;
    
    console.log('Payment failure received:', { orderId, error });

    if (!req.session.user) {
      return res.redirect('/login');
    }

    let order;
    
    // Try to find the order using different methods
    if (orderId) {
      order = await Order.findById(orderId);
    } else if (req.session.checkout?.orderId) {
      order = await Order.findById(req.session.checkout.orderId);
    }

    if (!order) {
      console.error('Order not found for payment failure');
      // Redirect to orders page if order not found
      return res.redirect('/user/orders');
    }

    // Verify the order belongs to the current user
    if (order.user.toString() !== req.session.user._id.toString()) {
      console.error('Order ownership mismatch');
      return res.redirect('/user/orders');
    }

    // Update order status to failed
    order.paymentStatus = 'failed';
    order.status = 'Payment Failed';
    order.paymentError = error || 'Payment was cancelled or failed';
    order.failedAt = new Date();
    
    await order.save();

    // Restore product quantities
    await restoreProductQuantities(order);

    // Prepare retry data in session
    req.session.checkout = {
      productIds: order.products.map(p => p.product.toString()),
      quantities: order.products.map(p => p.quantity),
      offerPrices: order.products.map(p => p.unitPrice),
      totalAmount: order.totalAmount,
      orderId: order._id.toString(),
      isRetry: true
    };
    req.session.retryOrderId = order._id;

    // Render payment failed page
    res.render('user/payment-failed', {
      order: {
        _id: order._id,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        products: order.products
      },
      error: error || 'Payment processing failed',
      retryCheckoutUrl: '/user/checkout',
      orderDetailsUrl: `/user/orders/${order._id}`,
      supportEmail: 'support@keitaishoppe.com',
      user: req.session.user
    });

  } catch (err) {
    console.error('Payment failure handling error:', err.message);
    // Fallback to simple error page
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('user/payment-error', {
      message: 'Failed to process payment failure. Please check your orders.',
      retryUrl: '/user/orders',
      user: req.session.user
    });
  }
};

// Helper function to restore product quantities
async function restoreProductQuantities(order) {
  try {
    for (const item of order.products) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { quantity: item.quantity } },
        { new: true }
      );
    }
    console.log(`✅ Restored quantities for order ${order._id}`);
  } catch (error) {
    console.error('❌ Error restoring product quantities:', error);
    // Don't throw error here as it shouldn't block the main flow
  }
}

exports.renderRetryPaymentPage = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!req.session.user) {
      return res.redirect('/login');
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).render('user/error', {
        message: 'Order not found',
        user: req.session.user
      });
    }

    // Verify order ownership
    if (order.user.toString() !== req.session.user._id.toString()) {
      return res.status(HTTP_STATUS.FORBIDDEN).render('user/error', {
        message: 'Access denied',
        user: req.session.user
      });
    }

    res.render('user/payment-failed', {
      order: {
        _id: order._id,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        products: order.products
      },
      error: 'Please retry your payment.',
      retryCheckoutUrl: '/user/checkout',
      orderDetailsUrl: `/user/orders/${order._id}`,
      supportEmail: 'support@keitaishoppe.com',
      user: req.session.user
    });

  } catch (err) {
    console.error('Error rendering retry page:', err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('user/error', {
      message: 'Failed to load retry page',
      user: req.session.user
    });
  }
};

exports.paymentSuccess = async (req, res) => {
  try {
    const { orderId } = req.query;

    if (!orderId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).render('user/error', {
        message: 'Order ID is required',
        user: req.session.user
      });
    }

    const order = await Order.findById(orderId)
      .populate('products.product')
      .populate('selectedAddress');

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).render('user/error', {
        message: 'Order not found',
        user: req.session.user
      });
    }

    res.render('user/payment-success', {
      paymentMethod: 'Razorpay',
      paymentVerified: true,
      orderId: order._id,
      orderItems: order.products,
      address: order.selectedAddress,
      totalAmount: order.totalAmount,
      deliveryCharge: order.deliveryCharge || 0,
      estimatedDate: order.estimatedDelivery,
      checkoutUrl: '/user/checkout',
      user: req.session.user
    });

  } catch (err) {
    console.error('Payment success page error:', err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('user/error', {
      message: 'Failed to load payment success page',
      user: req.session.user
    });
  }
};

exports.retryPayment = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!req.session.user) {
      return res.redirect('/login');
    }

    const order = await Order.findOne({ _id: orderId, user: req.session.user._id });

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Prepare checkout session for retry
    req.session.checkout = {
      productIds: order.products.map(p => p.product.toString()),
      quantities: order.products.map(p => p.quantity),
      offerPrices: order.products.map(p => p.unitPrice),
      totalAmount: order.totalAmount,
      orderId: order._id.toString(),
      isRetry: true
    };
    req.session.retryOrderId = order._id;

    res.json({
      success: true,
      redirectUrl: '/user/checkout'
    });

  } catch (err) {
    console.error('Error in retryPayment:', err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Something went wrong'
    });
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
      return res.status(HTTP_STATUS.NOT_FOUND).render('user/error', {
        message: 'Order not found',
        user: user
      });
    }

    if (order.status !== 'Payment Failed' && order.paymentStatus !== 'failed') {
      return res.status(HTTP_STATUS.BAD_REQUEST).render('user/error', {
        message: 'Payment retry is not allowed for this order',
        user: user
      });
    }

    // Set up session for retry
    req.session.checkout = {
      productIds: order.products.map(p => p.product._id.toString()),
      quantities: order.products.map(p => p.quantity),
      offerPrices: order.products.map(p => p.unitPrice),
      totalAmount: order.totalAmount,
      orderId: order._id.toString(),
      isRetry: true
    };
    req.session.retryOrderId = order._id;

    res.redirect('/user/checkout');

  } catch (err) {
    console.error('Error in retryPaymentFromOrder:', err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('user/error', {
      message: 'Server error during payment retry',
      user: req.session.user
    });
  }
};

// Webhook handler for additional security
exports.handleWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    const crypto = require('crypto');
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');

    if (digest !== signature) {
      console.error('Webhook signature verification failed');
      return res.status(400).json({ status: 'error' });
    }

    const { event, payload } = req.body;

    if (event === 'payment.failed') {
      const { payment } = payload;
      const order = await Order.findOne({ razorpayPaymentId: payment.id });
      
      if (order) {
        order.paymentStatus = 'failed';
        order.status = 'Payment Failed';
        order.paymentError = payment.error_description || 'Payment failed';
        await order.save();
        
        await restoreProductQuantities(order);
      }
    }

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ status: 'error' });
  }
};