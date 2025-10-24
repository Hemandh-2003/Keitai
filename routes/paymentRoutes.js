const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const orderController = require('../controllers/orderController');
const { isLoggedIn } = require('../middleware/authMiddleware');

// Payment Initialization Routes
router.post('/create-order', isLoggedIn, paymentController.initiatePayment);
router.post('/create-razorpay-order', isLoggedIn, paymentController.createRazorpayOrder);

// Payment Processing Routes
router.post('/verify-payment', isLoggedIn, paymentController.verifyPayment);
router.post('/payment/verify', isLoggedIn, paymentController.verifyPayment);

// Payment Status Routes
router.get('/payment/success/:orderId', isLoggedIn, paymentController.paymentSuccess);
router.get('/payment/failed', isLoggedIn, paymentController.paymentFailed);
router.get('/failed', isLoggedIn, paymentController.paymentFailed);

// Payment Retry Routes
router.post('/retry-payment/:orderId', isLoggedIn, paymentController.retryPaymentFromOrder);
router.get('/retry-payment-page/:orderId', isLoggedIn, paymentController.renderRetryPaymentPage);

// Order Management Routes
router.post('/orders/:orderId/cancel', isLoggedIn, orderController.cancelOrder);
router.post('/orders/:orderId/return', isLoggedIn, orderController.requestReturn);

// Order Details Route
router.get('/order-details/:orderId', isLoggedIn, orderController.getOrderDetails);

// Webhook Route (if using Razorpay webhooks)
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;