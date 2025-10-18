const express = require('express');
const { isLoggedIn } = require('../middleware/authMiddleware');
const cartController = require('../controllers/cartController');
const checkBlockedUser = require('../middleware/checkBlocked');

const router = express.Router();

// Add item to cart
router.post('/add', isLoggedIn, cartController.addToCart);

// Product Details
router.get('/product/:productId', isLoggedIn,cartController.getProductDetails);

// Get cart
router.get('/', isLoggedIn, checkBlockedUser, cartController.getCart); 

// Update cart item quantity
router.post('/update', isLoggedIn, cartController.updateCart);

// Remove item from cart
router.post('/remove', isLoggedIn, cartController.removeFromCart);
router.post('/cart/clear', cartController.clearCart);

//count
router.get('/count', cartController.getCartCount);
module.exports = router;
