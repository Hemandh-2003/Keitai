const Review = require('../models/review');
const Product = require('../models/Product');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Add a review (User)
exports.addReview = async (req, res) => {
  try {
    const { productId, title, comment, rating } = req.body;

    const images = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        images.push(file.filename);
      });
    }

    const review = new Review({
      user: req.user._id,
      product: productId,
      title,
      comment,
      rating,
      images
    });

    await review.save();

    await Product.findByIdAndUpdate(productId, {
      $inc: { reviewCount: 1 },
      $set: { averageRating: await calculateAverageRating(productId) }
    });

    return res.redirect(`/product/${productId}#reviews`);
  } catch (error) {
    console.error('Error adding review:', error.message);
    res.status(500).json({ error: 'Error submitting review', details: error.message });
  }
};



async function calculateAverageRating(productId) {
  const result = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: null, average: { $avg: "$rating" } } }
  ]);
  return result[0]?.average || 0;
}


// Admin reply to a review
exports.replyToReview = async (req, res) => {
  try {
    const { reply } = req.body;

    await Review.findByIdAndUpdate(req.params.reviewId, { 
      adminReply: { text: reply, date: new Date() } 
    });

    res.json({ message: 'Reply saved successfully' }); // ✅ respond with JSON
  } catch (error) {
    console.error('Error replying to review:', error);
    res.status(500).json({ error: 'Reply failed' });
  }
};


// Fetch reviews for a product
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

// Admin view of all reviews
exports.listAllReviews = async (req, res) => {
  try {

    const { user: userId, product: productId, page = 1, sort = "newest", limit = 4 } = req.query;
    const perPage = parseInt(limit) || 4; 
    const skip = (page - 1) * perPage;

    const filter = {};
    if (userId && userId !== 'all') filter.user = userId;
    if (productId && productId !== 'all') filter.product = productId;

    let sortOption = {};
    if (sort === "newest") sortOption = { createdAt: -1 };
    else if (sort === "oldest") sortOption = { createdAt: 1 };
    else if (sort === "highest") sortOption = { rating: -1 };
    else if (sort === "lowest") sortOption = { rating: 1 };
    else sortOption = { createdAt: -1 }; 

    const reviews = await Review.find(filter)
      .populate('user', 'name email')
      .populate('product', 'name')
      .skip(skip)
      .limit(perPage)
      .sort(sortOption);

    const totalReviews = await Review.countDocuments(filter);
    const totalPages = Math.ceil(totalReviews / perPage);

    const users = await User.find().select('name email');
    const products = await Product.find().select('name');

    res.render('admin/reviews', {
      reviews,
      users,
      products,
      currentPage: parseInt(page),
      totalPages,
      selectedUserId: userId || 'all',
      selectedProductId: productId || 'all',
      selectedSort: sort,
      limit: perPage,
      queryString: `&user=${userId || 'all'}&product=${productId || 'all'}&sort=${sort}&limit=${perPage}`
    });
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const reviewId = req.params.reviewId;
    await Review.findByIdAndDelete(reviewId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: 'Failed to delete review.' });
  }
};