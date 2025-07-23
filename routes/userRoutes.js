const express = require('express');
const { isLoggedIn } = require('../middleware/authMiddleware');
const userController = require('../controllers/userController');
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
router.get('/orders', ...protect, userController.viewOrders);
router.get('/order/:id', ...protect, userController.viewOrderDetails);
router.post('/orders/cancel/:id', ...protect, userController.cancelOrder);
router.post('/orders/:id/cancel', userController.cancelEntireOrder);
router.post('/orders/:orderId/return/:productId', userController.returnProduct);
router.post('/orders/return/:id', userController.returnOrder);
router.post('/orders/cancel-item/:orderId', userController.cancelSingleItem);
router.get('/order/:id/invoice', userController.downloadInvoice);

// Product Routes
router.get('/home', userController.getProducts);
router.get('/product/:productId', userController.getProductDetailsWithRelated);
// Checkout Routes
router.get('/checkout', ...protect, userController.getCheckout);
router.post('/checkout', ...protect, userController.checkout);
router.post('/place-order', ...protect, userController.placeOrder);
router.post('/confirm-payment', ...protect, userController.confirmPayment);
router.get('/confirm-payment', ...protect, userController.renderConfirmPayment);

// Filter Routes
//router.get('/laptop', userController.getLaptopProducts);

// Settings and Password Routes
router.get('/settings', ...protect, userController.getSettingsPage);
router.post('/change-password', ...protect, upload.none(), userController.changePassword);
router.post('/update-name', ...protect, userController.updateUserName);

// Forgot Password Routes
router.get('/forgot-password', userController.getForgotPasswordPage);
router.post('/forgot-password', userController.handleForgotPassword);
router.get('/resend-otp', userController.resendOtp);
router.get('/reset-password/:email', userController.getResetPasswordPage);
router.post('/reset-password', userController.handleResetPassword);
console.log(userController.verifyOtp);
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
module.exports = router;
