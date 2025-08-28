const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const orderController = require('../controllers/orderController'); // ✅ Fix here
const { isLoggedIn } = require('../middleware/authMiddleware');

// Use the correct function based on your controller
router.post('/create-order', isLoggedIn, paymentController.initiatePayment); // or .createOrder if renamed
router.post('/success', isLoggedIn, paymentController.paymentSuccess);
router.post('/failed', isLoggedIn, paymentController.paymentFailed);
router.post('/retry-payment-page', isLoggedIn, paymentController.renderRetryPaymentPage);
router.post('/payment/verify', paymentController.verifyPayment);
router.get('/payment/success/:orderId', paymentController.paymentSuccess);
router.get('/payment/failed', paymentController.paymentFailed);
router.get('/failed', isLoggedIn, paymentController.paymentFailed);
router.post('/retry-payment', paymentController.retryPayment);

// Order management routes
router.post('/orders/:orderId/cancel', orderController.cancelOrder);
router.post('/orders/:orderId/return', orderController.requestReturn);

module.exports = router;
