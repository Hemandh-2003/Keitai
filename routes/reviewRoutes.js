const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { isLoggedIn } = require('../middleware/authMiddleware');
const checkBlockedUser = require('../middleware/checkBlocked');
const { getProductDetailsWithRelated } = require('../controllers/productController');
const { isAdmin } = require('../middleware/adminMiddleware');
const multer = require('multer');

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// Submit a review
router.post('/submit', isLoggedIn, checkBlockedUser, upload.array('images', 3), reviewController.addReview);

// Correct route for product page with reviews
router.get('/product/:productId', getProductDetailsWithRelated);

// Admin reviews page
router.get('/admin/reviews', isAdmin, reviewController.listAllReviews);

// Admin reply to review
router.post('/admin/reviews/:reviewId/reply', isAdmin, reviewController.replyToReview);

// Admin delete review
router.delete('/admin/reviews/:reviewId', isAdmin, reviewController.deleteReview);

module.exports = router;
