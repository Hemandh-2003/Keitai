const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const orderController = require('../controllers/orderController');
const { isLoggedIn } = require('../middleware/authMiddleware');

// Payment Initialization
router.post('/create-order', isLoggedIn, paymentController.initiatePayment);
router.post('/payment/verify', isLoggedIn, paymentController.verifyPayment);

// Payment Status Routes
router.post('/success', isLoggedIn, paymentController.paymentSuccess);
router.get('/payment/success/:orderId', isLoggedIn, paymentController.paymentSuccess);
router.get('/payment/failed', isLoggedIn, paymentController.paymentFailed);
router.get('/failed', isLoggedIn, paymentController.paymentFailed);

// Payment Retry Routes
router.post('/retry-payment', isLoggedIn, paymentController.retryPaymentFromOrder);
router.get('/retry-payment-page/:orderId', isLoggedIn, paymentController.renderRetryPaymentPage);

// Order Management Routes
router.get('/order-details/:orderId', isLoggedIn, orderController.getOrderDetails);
router.post('/orders/:orderId/cancel', isLoggedIn, orderController.cancelOrder);
router.post('/orders/:orderId/return', isLoggedIn, orderController.requestReturn);

module.exports = router;