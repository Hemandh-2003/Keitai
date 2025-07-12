const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const User = require('../models/User');

// Add product to wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    const productExists = await Product.findById(productId);
    if (!productExists) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let wishlist = await Wishlist.findOne({ user: userId });

    if (wishlist) {
      const alreadyExists = wishlist.products.includes(productId);

      if (alreadyExists) {
        return res.status(200).json({ message: 'Already in wishlist', wishlist: wishlist.products });
      }

      wishlist.products.push(productId);
      await wishlist.save();
    } else {
      wishlist = await Wishlist.create({
        user: userId,
        products: [productId]
      });
    }

    // Populate products before sending response
    await wishlist.populate('products');

    return res.status(200).json({ message: 'Product added to wishlist!', wishlist: wishlist.products });
  } catch (err) {
    console.error('❌ Error adding to wishlist:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};


// Remove product from wishlist
exports.removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user?._id;

    if (!userId) return res.status(401).send({ message: 'Unauthorized access' });

    const wishlist = await Wishlist.findOneAndUpdate(
      { user: userId },
      { $pull: { products: productId } },
      { new: true }
    ).populate('products');

    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    res.status(200).json({ message: 'Product removed from wishlist', wishlist: wishlist.products });
  } catch (err) {
    console.error('Error removing from wishlist:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// View user's wishlist with pagination
exports.viewWishlist = async (req, res) => {
  try {
    const userId = req.user?._id;
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    if (!userId) {
      return res.status(401).send({ message: 'Unauthorized access' });
    }

    const wishlist = await Wishlist.findOne({ user: userId }).populate('products');

    if (!wishlist) {
      return res.render('user/wishlist', {
        wishlist: [],
        currentPage: page,
        totalPages: 0,
      });
    }

    const totalProducts = wishlist.products.length;
    const totalPages = Math.ceil(totalProducts / limit);
    const paginatedProducts = wishlist.products.slice(skip, skip + limit);

    res.render('user/wishlist', {
      wishlist: paginatedProducts,
      currentPage: page,
      totalPages: totalPages,
    });
  } catch (err) {
    console.error('Error retrieving wishlist:', err);
    res.status(500).json({ success:false, message: 'Server error' });
  }
};

// Toggle wishlist status
exports.toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user?._id;

    if (!userId) return res.status(401).send({ message: 'Unauthorized access' });

    const wishlist = await Wishlist.findOne({ user: userId });
    const isInWishlist = wishlist?.products.includes(productId);

    if (isInWishlist) {
      await Wishlist.findOneAndUpdate(
        { user: userId },
        { $pull: { products: productId } }
      );
    } else {
      await Wishlist.findOneAndUpdate(
        { user: userId },
        { $addToSet: { products: productId } },
        { upsert: true }
      );
    }

    res.status(200).json({ isInWishlist: !isInWishlist });
  } catch (err) {
    console.error('Error toggling wishlist:', err);
    res.status(500).json({ message: 'Server error' });
  }
};