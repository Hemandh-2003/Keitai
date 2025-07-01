const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { isLoggedIn } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/adminMiddleware');
const checkBlockedUser = require('../middleware/checkBlocked');
const multer = require('multer');

// Image upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// User adds a review
router.post(
  '/submit',
  isLoggedIn,
  checkBlockedUser,
  upload.single('image'),
  reviewController.addReview
);

// Get all reviews for a product (AJAX call if needed)
router.get('/product/:productId', reviewController.getReviewsByProduct);

// Admin replies to a review
router.post('/reply/:reviewId', isAdmin, reviewController.replyToReview);

// Admin view all reviews
router.get('/admin', isAdmin, reviewController.listAllReviews);

module.exports = router;
