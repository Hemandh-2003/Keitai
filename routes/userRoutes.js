const express = require('express');
const userOrderController= require('../controllers/userOrderController');
const checkoutController= require('../controllers/checkoutController');
const productController= require('../controllers/productController');
const settingsController= require('../controllers/settingsController');
const { isLoggedIn } = require('../middleware/authMiddleware');
const userController = require('../controllers/userController');
const orderController = require('../controllers/orderController');
const checkBlockedUser = require('../middleware/checkBlocked');
const couponController = require('../controllers/couponController');
const multer = require('multer');
const upload = multer();
const router = express.Router();

// Middleware to protect user routes
const protect = [isLoggedIn, checkBlockedUser];

// Profile Routes
router.get('/profile', ...protect, userController.getProfile);
router.get('/address', ...protect, userController.getAddresses);
router.post('/address/add', ...protect, userController.addAddress);
router.get('/address/edit/:addressId', ...protect, userController.getEditAddress);
router.post('/address/edit/:addressId', ...protect, userController.updateAddress);
router.get('/address/remove/:addressId', ...protect, userController.removeAddress);

// Order Routes
router.get('/orders', ...protect, userOrderController.viewOrders);
router.get('/order/:id', ...protect, userOrderController.viewOrderDetails);
router.post('/orders/cancel/:id', ...protect, userOrderController.cancelOrder);
router.post('/orders/:id/cancel', userOrderController.cancelEntireOrder);//not using
router.post('/orders/:orderId/return/:productId', userOrderController.returnProduct);
router.post('/orders/return/:id', userOrderController.returnOrder);
router.post('/orders/cancel-item/:orderId/:productId',...protect,userOrderController.cancelSingleItem);
router.get('/order/:id/invoice', userOrderController.downloadInvoice);

// Product Routes
// router.get('/home', userController.getProducts);
router.get('/product/:productId', productController.getProductDetailsWithRelated);

// Checkout Routes
router.get('/checkout', ...protect, checkoutController.getCheckout);
router.post('/checkout', ...protect, checkoutController.checkout);
router.post('/place-order', ...protect, checkoutController.placeOrder);
router.get('/order-confirmation/:sessionId', protect, checkoutController.renderOrderConfirmation);
router.post('/confirm-payment', ...protect, checkoutController.confirmPayment);
router.get('/confirm-payment', ...protect, checkoutController.renderConfirmPayment);
router.post('/address/create-inline', checkoutController.createInlineAddress);
router.get('/retry-checkout', checkoutController.retryCheckout);
router.get('/retry-checkout/:orderId', checkoutController.retryCheckoutWithOrderId);
router.post('/verify-payment', checkoutController.verifyPayment);

// Settings and Password Routes
router.get('/settings', ...protect, settingsController.getSettingsPage);
router.post('/change-password', ...protect, upload.none(), settingsController.changePassword);
router.post('/update-name', ...protect, settingsController.updateUserName);

// Forgot Password Routes
router.get('/forgot-password', userController.getForgotPasswordPage);
router.post('/forgot-password', userController.handleForgotPassword);
router.get('/resend-otp', userController.resendOtp);
router.get('/reset-password/:email', userController.getResetPasswordPage);
router.post('/reset-password', userController.handleResetPassword);
//console.log(userController.verifyOtp);
router.post('/verify-otp-reset', userController.verifyOtp);
router.get('/product/:id/related', userController.getProductDetailsWithRelated);

//coupon Routes
router.post('/apply-coupon', ...protect, couponController.applyCoupon);
router.post('/remove-coupon', ...protect, couponController.removeCoupon);

//wallet
router.get('/wallet', ...protect,userController.renderWalletPage);

// About Us Route
router.get('/aboutus', userController.getAboutUsPage);
router.get('/services', userController.getServicesPage);
router.get('/support', userController.getSupportPage);
router.get('/contact', userController.getContactPage);

//payment
router.post('/retry-payment', ...protect, userController.retryPayment);

//whishlist
router.post('/add-to-cart-from-wishlist/:productId', ...protect, userController.addToCartFromWishlist);
module.exports = router;
