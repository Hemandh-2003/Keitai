const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { isLoggedIn } = require('../middleware/authMiddleware');
const checkBlockedUser = require('../middleware/checkBlocked');

const protect = [isLoggedIn, checkBlockedUser];

router.post('/add', ...protect, wishlistController.addToWishlist);
router.delete('/remove/:productId', ...protect, wishlistController.removeFromWishlist);
router.get('/', ...protect, wishlistController.viewWishlist);
router.post('/toggle', ...protect, wishlistController.toggleWishlist);
module.exports = router;