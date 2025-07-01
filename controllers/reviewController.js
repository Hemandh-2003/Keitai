const Review = require('../models/review');
const Product = require('../models/Product');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

// Add a review (User)
exports.addReview = async (req, res) => {
  try {
    const { productId, title, comment, rating } = req.body;
    
    // Handle multiple image uploads
    const images = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        images.push(file.filename);
      });
    }

    const review = new Review({
      user: req.user._id, // Use the authenticated user's ID
      product: productId,
      title,
      comment,
      rating,
      images
    });

    await review.save();
    
    // Update product rating stats (optional)
    await Product.findByIdAndUpdate(productId, {
      $inc: { reviewCount: 1 },
      $set: { averageRating: await calculateAverageRating(productId) }
    });
    
    res.redirect(`/product/${productId}#reviews`);
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({ error: 'Error submitting review' });
  }
};

async function calculateAverageRating(productId) {
  const result = await Review.aggregate([
    { $match: { product: mongoose.Types.ObjectId(productId) } },
    { $group: { _id: null, average: { $avg: "$rating" } } }
  ]);
  return result[0]?.average || 0;
}

// Admin reply to a review
exports.replyToReview = async (req, res) => {
  try {
    const { reply } = req.body;
    await Review.findByIdAndUpdate(req.params.reviewId, { adminReply: reply });
    res.redirect('back');
  } catch (error) {
    console.error('Error replying to review:', error);
    res.status(500).send('Reply failed');
  }
};

// Fetch reviews for a product (User + Admin)
exports.getReviewsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const reviews = await Review.find({ product: productId }).populate('user');
    res.json(reviews);
  } catch (err) {
    console.error('Fetching reviews failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin view of all reviews (optional)
exports.listAllReviews = async (req, res) => {
  const reviews = await Review.find().populate('user').populate('product');
  res.render('admin/reviews', { reviews });
};
