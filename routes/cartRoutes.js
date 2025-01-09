const express = require('express');
const { isLoggedIn } = require('../middleware/authMiddleware');
const cartController = require('../controllers/cartController');
const checkBlockedUser = require('../middleware/checkBlocked');

const router = express.Router();

// Add item to cart
router.post('/add', isLoggedIn, cartController.addToCart);

// Get cart
router.get('/', isLoggedIn, checkBlockedUser, cartController.getCart); // Ensure correct use of middleware

// Update cart item quantity
router.post('/update', isLoggedIn, cartController.updateCart);

// Remove item from cart
router.post('/remove', isLoggedIn, cartController.removeFromCart);

module.exports = router;
