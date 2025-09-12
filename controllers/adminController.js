const razorpay = require('../config/razorpay');
const User = require('../models/User');
const Review = require('../models/review'); 
const Category = require('../models/Category');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Offer = require('../models/Offer');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const Coupon = require('../models/Coupon');
const crypto = require('crypto');
const Razorpay = require('razorpay');
exports.adminDashboard = (req, res) => {
  res.render('admin/dashboard');
};
//Admin
exports.getDashboardStats = async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;

    let match = { status: { $ne: 'Cancelled' } };

    if (range === 'daily') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      match.createdAt = { $gte: today, $lt: tomorrow };
    } else if (range === 'monthly') {
      const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
      match.createdAt = { $gte: firstDay, $lt: lastDay };
    } else if (range === 'yearly') {
      const year = new Date().getFullYear();
      const start = new Date(year, 0, 1);
      const end = new Date(year + 1, 0, 1);
      match.createdAt = { $gte: start, $lt: end };
    } else if (startDate && endDate) {
      match.createdAt = { $gte: new Date(startDate), $lt: new Date(endDate) };
    }

    const orders = await Order.find(match).populate('products.product');
    const sales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const orderCount = orders.length;

   
    const topProducts = await Order.aggregate([
      { $match: match },
      { $unwind: '$products' },
      {
        $group: {
          _id: '$products.product',
          totalSold: { $sum: '$products.quantity' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          name: '$product.name',
          totalSold: 1
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);

  
    const topCategories = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $project: {
          name: '$category.name',
          count: 1
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      sales,
      orderCount,
      topProducts,
      topCategories,
      message: 'Dashboard stats fetched successfully'
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
// User management
exports.listUsers = async (req, res) => {
  try {
    const sortBy = req.query.sort || 'all';
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    let filter = {};
    let sort = { createdAt: -1 };

    switch (sortBy) {
      case 'blocked':
        filter.isBlocked = true;
        break;
      case 'unblocked':
        filter.isBlocked = false;
        break;
      default:
        break;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { userCode: { $regex: search, $options: 'i' } }
      ];
    }

    const totalUsers = await User.countDocuments(filter);

    const users = await User.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalUsers / limit);

    res.render('admin/users', {
      users,
      sortBy,
      searchQuery: search,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).send('Error listing users');
  }
};

exports.blockUser = async (req, res) => {
  try {
    
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: true });

    
    if (req.session.userId === user._id.toString()) {
      req.session.isBlocked = true; 
    }

    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).send('Error blocking user');
  }
};


exports.unblockUser = async (req, res) => {
  try {
    
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: false });

    
    if (req.session.userId === user._id.toString()) {
      req.session.isBlocked = false; 
    }

    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).send('Error unblocking user');
  }
};


// Category management
exports.loadCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.render('admin/categories', { categories, error: null }); 
  } catch (error) {
    console.error('Error loading categories:', error);
    res.status(500).send('Server Error');
  }
};

// Add a new category
exports.addCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const trimmedName = name.trim();

    if (!trimmedName) {
      const categories = await Category.find();
      return res.render('admin/categories', {
        categories,
        error: 'Category name cannot be empty.',
      });
    }

    if (!/^[A-Za-z\s]{1,11}$/.test(trimmedName)) {
      const categories = await Category.find();
      return res.render('admin/categories', {
        categories,
        error: 'Category name must contain only letters and up to 11 characters.',
      });
    }

    const slug = trimmedName.toLowerCase().replace(/\s+/g, '-');

    const existingCategory = await Category.findOne({ name: new RegExp(`^${trimmedName}$`, 'i') });
    if (existingCategory) {
      const categories = await Category.find();
      return res.render('admin/categories', {
        categories,
        error: 'This category already exists in the list.',
      });
    }

    const newCategory = new Category({ name: trimmedName, slug });
    await newCategory.save();

    res.redirect('/admin/categories');
  } catch (error) {
    console.error('Error adding category:', error);
    const categories = await Category.find();
    return res.render('admin/categories', {
      categories,
      error: 'Something went wrong. Please try again.',
    });
  }
};

// Delete a category
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    await Category.findByIdAndDelete(id);
    res.redirect('/admin/categories');
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).send('Server Error');
  }
};

// Edit a category
exports.loadEditCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    res.status(200).render('admin/edit-category', { category });
  } catch (error) {
    console.error('Error loading edit page:', error);
    res.status(500).send('Server Error');
  }
};

exports.editCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const slug = name.toLowerCase().replace(/\s+/g, '-');

    
    const existingCategory = await Category.findOne({ slug });
    if (existingCategory && existingCategory._id.toString() !== id) {
      return res.status(400).render('admin/edit-category', {
        errorMessage: 'Category name already exists.',
        category: { name }  
      });
    }

    
    await Category.findByIdAndUpdate(id, { name, slug });

    res.redirect('/admin/categories');
  } catch (error) {
    console.error('Error editing category:', error);
    res.status(500).send('Server Error');
  }
};

// Product management
exports.listProducts = async (req, res) => {
  try {
   
    const categoryId = req.query.category || '';

  
    const page = parseInt(req.query.page) || 1;
    const limit = 10; 
    const skip = (page - 1) * limit; 

    
    const categories = await Category.find();

    
    let totalProducts;
    if (categoryId) {
      totalProducts = await Product.countDocuments({ category: categoryId, isDeleted: false });
    } else {
      totalProducts = await Product.countDocuments({ isDeleted: false });
    }

    
    const totalPages = Math.ceil(totalProducts / limit);

  
    let products;
    if (categoryId) {
      products = await Product.find({ category: categoryId, isDeleted: false })
        .skip(skip)
        .limit(limit)
        .populate('category');
    } else {
      products = await Product.find({ isDeleted: false })
        .skip(skip)
        .limit(limit)
        .populate('category');
    }

   
    res.render('admin/products', {
      products,
      categories,
      selectedCategory: categoryId,
      currentPage: page,
      totalPages: totalPages,
    });
  } catch (error) {
    //console.log(error);
    res.status(500).send('Error loading products.');
  }
};

//add product form
exports.addProduct = async (req, res) => {
  const categories = await Category.find({ isDeleted: false });
  res.render('admin/products', { categories }); 
};


const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

exports.createProduct = async (req, res) => {
  try {
    const images = req.files.images ? req.files.images.map(file => file.filename) : [];
    const highlights = req.files.highlights ? req.files.highlights.map(file => file.filename) : [];

    
    const allFiles = [
      ...(req.files.images || []),
      ...(req.files.highlights || []),
    ];

    for (const file of allFiles) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        
        fs.unlinkSync(path.join(__dirname, '..', 'public', 'uploads', file.filename));
        throw new Error(`Invalid file type: ${file.originalname}`);
      }
    }

    
    if (images.length > 4) throw new Error('Only 4 product images allowed.');
    if (highlights.length > 4) throw new Error('Only 4 product highlights allowed.');

    
    await new Product({
      name: req.body.name,
      category: req.body.category,
      brand: req.body.brand,
      regularPrice: req.body.regularPrice,
      salesPrice: req.body.salesPrice || null,
      quantity: req.body.quantity,
      productOffer: req.body.productOffer || '',
      isBlocked: req.body.isBlocked || false,
      images,
      highlights,
      description: req.body.description || '',
    }).save();

    res.redirect('/admin/products');
  } catch (error) {
    console.error('Product creation error:', error.message);
    res.status(400).send('Error: ' + error.message);
  }
};



const fs = require('fs');
const path = require('path');

exports.editProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category');
    if (!product) {
      return res.status(404).send('Product not found');
    }
    const categories = await Category.find({});
    res.render('admin/editProduct', { product, categories });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};


exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).send('Product not found');

    const categoryExists = await Category.findById(req.body.category);
    if (!categoryExists) return res.status(400).send('Invalid category');

    
    const newImages = req.files['images']?.map(file => file.filename) || [];
    const newHighlights = req.files['highlights']?.map(file => file.filename) || [];

   
    product.images = [...product.images, ...newImages].slice(0, 4);     
    product.highlights = [...product.highlights, ...newHighlights].slice(0, 4); 

    
    product.name = req.body.name;
    product.category = req.body.category;
    product.brand = req.body.brand;
    product.regularPrice = req.body.regularPrice;
    product.salesPrice = req.body.salesPrice || null;

    
    if (product.salesPrice && product.salesPrice > product.regularPrice) {
      return res.status(400).send('Sales Price cannot be greater than Regular Price');
    }

    product.quantity = req.body.quantity;
    product.productOffer = req.body.productOffer || '';
    product.description = req.body.description || '';

    await product.save();
    res.redirect('/admin/products');

  } catch (error) {
    console.error('Update Product Error:', error);
    res.status(500).send('Internal Server Error');
  }
};

exports.deleteImage = async (req, res) => {
  const { filename } = req.params;

  try {
    const product = await Product.findOne({ images: filename });

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    product.images = product.images.filter(img => img !== filename);
    await product.save();
    
    const filePath = path.join(__dirname, '../public/uploads', filename);
    fs.unlink(filePath, err => {
      if (err) console.log("File not deleted:", err);
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Delete image error:", err);
    res.status(500).json({ success: false });
  }
};

exports.deleteHighlight = async (req, res) => {
  const { filename } = req.params;

  try {
    const product = await Product.findOne({ highlights: filename });

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    product.highlights = product.highlights.filter(hl => hl !== filename);
    await product.save();

    const filePath = path.join(__dirname, '../public/uploads', filename);
    fs.unlink(filePath, err => {
      if (err) console.log("File not deleted:", err);
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Delete highlight error:", err);
    res.status(500).json({ success: false });
  }
};


// Block Product
exports.blockProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    await Product.findByIdAndUpdate(productId, { isBlocked: true });
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Error blocking product:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Unblock Product
exports.unblockProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    await Product.findByIdAndUpdate(productId, { isBlocked: false });
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Error unblocking product:', error);
    res.status(500).send('Internal Server Error');
  }
};

exports.getProductDetailsWithRelated = async (req, res) => {
  try {
    const productId = req.params.productId;
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const product = await Product.findById(productId)
      .populate('category')
      .populate('offers');

    if (!product || product.isBlocked) {
      return res.render("user/Product-details", {
        user: req.session.user,
        product: null,          
        variants: [],
        relatedProducts: [],
        offerDetails: null,
        finalPrice: null,
        reviews: [],
        currentPage: page,
        totalPages: 0,
        errorMessage: !product ? "Product not found." : "This product is blocked."
      });
    }

    const offerDetails=await product.getBestOfferPrice();
    product.offerDetails = offerDetails;

    let variants = [];
    try {
      const nameParts = product.name.split(" ");
      const modelName = nameParts.slice(0, 3).join(" ");
      const variantRegex = new RegExp(`^${modelName}`, "i");

     const allVariants = await Product.find({
  _id: { $ne: productId },
  isBlocked: false,
  name: variantRegex
}).populate("offers category");


      variants = [];
      for (const variant of allVariants) {
        const variantOffer = await variant.getBestOfferPrice();
        if (variantOffer.price > 50000) {
          variant.offerDetails = variantOffer;
          variants.push(variant);
        }
      }
    } catch (err) {
      console.error("Error fetching variants:", err);
    }

    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $nin: [productId, ...variants.map(v => v._id)] },
      isBlocked: false
    })
      .limit(4)
      .populate("offers category");

    for (const related of relatedProducts) {
      related.offerDetails = await related.getBestOfferPrice();
    }

    const reviews = await Review.find({ product: productId })
      .populate("user")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalReviews = await Review.countDocuments({ product: productId });
    const totalPages = Math.ceil(totalReviews / limit);

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const allReviews = await Review.find({ product: productId });
    allReviews.forEach(r => {
      const star = Math.round(r.rating);
      ratingDistribution[star] = (ratingDistribution[star] || 0) + 1;
    });

    product.reviewCount = allReviews.length;
    product.averageRating = allReviews.length
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
      : 0;
    product.ratingDistribution = ratingDistribution;

    res.render("user/Product-details", {
      user: req.session.user,
      product,
      variants,
      relatedProducts,
      offerDetails,
      finalPrice: offerDetails.price,
      reviews,
      currentPage: page,
      totalPages,
      errorMessage: null       
    });
  } catch (error) {
    console.error(error);
    res.render("user/Product-details", {
      user: req.session.user,
      product: null,
      variants: [],
      relatedProducts: [],
      offerDetails: null,
      finalPrice: null,
      reviews: [],
      currentPage: 1,
      totalPages: 0,
      errorMessage: "Something went wrong while loading the product."
    });
  }
};

exports.viewProductDetails = async (req, res) => {
  try {
    // console.log('viewProductDetail')

      const product = await Product.findById(req.params.id).populate('category');
      if (!product) {
          return res.status(404).send('Product not found');
      }
      res.render('user/Product-details', { product });
  } catch (error) {
      console.error(error);
      res.status(500).send('Error loading product details');
  }
};

exports.listOrders = async (req, res) => {
  try {
    const sort = req.query.sort || 'new';
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    let sortCriteria = {};
    let filterCriteria = {};

    switch (sort) {
      case 'new':
        sortCriteria = { createdAt: -1 };
        break;
      case 'old':
        sortCriteria = { createdAt: 1 };
        break;
      case 'cancelled':
        filterCriteria = { status: 'Cancelled' };
        sortCriteria = { createdAt: -1 };
        break;
      case 'user-cancelled':
        filterCriteria = { status: 'User Cancelled' };
        sortCriteria = { createdAt: -1 };
        break;
      case 'shipped':
        filterCriteria = { status: 'Shipped' };
        sortCriteria = { createdAt: -1 };
        break;
      case 'delivered':
        filterCriteria = { status: 'Delivered' };
        sortCriteria = { createdAt: -1 };
        break;
      case 'pending':
        filterCriteria = { status: 'Pending' };
        sortCriteria = { createdAt: -1 };
        break;
      case 'return-requested':
        filterCriteria = { returnRequested: true, returnStatus: 'Requested' };
        sortCriteria = { createdAt: -1 };
        break;
      default:
        sortCriteria = { createdAt: -1 };
    }

    const orders = await Order.find(filterCriteria)
      .sort(sortCriteria)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user')
      .populate('products.product')
      .exec();

    const totalOrders = await Order.countDocuments(filterCriteria);
    const totalPages = Math.ceil(totalOrders / limit);

    res.render('admin/orders', {
      orders,
      sort,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error('Error listing orders:', error.message);
    res.status(500).send('Error retrieving orders');
  }
};


// Change Order Status
exports.changeOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await Order.findOneAndUpdate(
      { orderId: orderId },
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.redirect('/admin/orders');
  } catch (error) {
    console.error('Error changing order status:', error);
    res.status(500).send('Error changing order status');
  }
};

exports.updateReturnStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { action } = req.body;

    if (!['Approved', 'Rejected'].includes(action)) {
      return res.status(400).send('Invalid action');
    }

    const order = await Order.findById(orderId).populate('user');
//console.log('Order:', order);

if (!order || order.returnStatus !== 'Requested') {
  return res.status(400).send('Invalid return request');
}

order.returnStatus = action;
order.returnRequested = false;
order.statusHistory.push({
  status: `Return ${action}`,
  updatedAt: new Date(),
});

 if (action === 'Approved') {
      const user = order.user;
      let totalRefund = 0;
      
      for (const returnedItem of order.returnedItems) {
        if (returnedItem.status !== 'Pending') continue;

        const orderedProduct = order.products.find(p => 
          p.product && p.product._id.toString() === returnedItem.product._id.toString()
        );

        if (orderedProduct) {
          const price = returnedItem.refundAmount / returnedItem.quantity || 
                       orderedProduct.unitPrice || 
                       orderedProduct.price || 
                       orderedProduct.product?.salesPrice || 
                       orderedProduct.product?.regularPrice || 
                       0;

          const itemRefund = price * returnedItem.quantity;
          totalRefund += itemRefund;

          returnedItem.status = 'Approved';
        }
      }

    if (totalRefund > 0) {
  await User.findByIdAndUpdate(user._id, {
    $inc: { 'wallet.balance': totalRefund },
    $push: {
      'wallet.transactions': {
        type: 'Credit',
        amount: totalRefund,
        reason: `Refund for returned items from order #${order.orderId}`,
        orderId: order._id,
        date: new Date()
      }
    }
  });
}

    }

    await order.save();

    res.redirect('/admin/orders?sort=return-requested');
  } catch (error) {
    console.error('Error updating return status:', error);
    res.status(500).send('Server error');
  }
};



// Cancel Order
exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId }).populate('products.product').exec();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order.status = 'Cancelled';
    await order.save();

    const bulkOps = order.products.map(item => ({
      updateOne: {
        filter: { _id: item.product._id },
        update: { $inc: { quantity: item.quantity } }
      }
    }));
    if (bulkOps.length > 0) await Product.bulkWrite(bulkOps);

    const user = await User.findById(order.user);
    const refundAmount = order.totalAmount;

    user.wallet.balance += refundAmount;
    user.wallet.transactions.push({
      type: 'Credit',
      amount: refundAmount,
      reason: 'Order Cancelled',
      orderId: order._id,
    });
    await user.save();

    res.redirect('/admin/orders');
  } catch (error) {
    console.error('Error canceling order:', error);
    res.status(500).send('Server error');
  }
};

// Payment Integration with Razorpay
exports.initiatePayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId });

    if (!order || isNaN(order.totalAmount)) {
      console.error('❌ Invalid order or total amount:', order?.totalAmount);
      return res.status(400).send('Invalid order');
    }

    const amountInPaise = Math.round(parseFloat(order.totalAmount) * 100);

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: order.orderId,
    };

   // console.log("📦 Razorpay Options:", options);

    const razorpayOrder = await razorpay.orders.create(options);
    

    order.paymentMethod = 'Online';
    order.razorpayOrderId = razorpayOrder.id;
    order.amount=razorpayOrder.amount;
    await order.save();
    //console.log(razorpayOrder)

    res.json({
      id: razorpayOrder.id,
      currency: razorpayOrder.currency,
      amount: razorpayOrder.amount,
      order_id: order.orderId
    });

  } catch (err) {
    console.error('❌ Razorpay creation failed:', err.message || err);
    res.status(500).send('Payment initiation failed');
  }
};


exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });

    if (!order) {
      return res.status(400).send('Invalid Order ID');
    }

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).send('Payment verification failed');
    }

    order.paymentStatus = 'Paid';
    order.razorpayPaymentId = razorpay_payment_id;
    order.status = 'Pending'; 
    await order.save();

    res.redirect(`/payment/success/${order.orderId}`);
  } catch (err) {
    console.error(err);
    res.redirect('/payment/failed');
  }
};

exports.viewOrderDetails = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId })
      .populate('user')
      .populate('products.product')
      .populate('selectedAddress');

    if (!order) {
      return res.status(404).send('Order not found');
    }

    res.render('admin/order-details', { 
      order,
      isAdmin: true 
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error loading order details');
  }
};

exports.processUserCancellation = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findOne({ orderId }).populate('products.product');
    
    if (!order) {
      return res.status(404).send('Order not found');
    }

    if (!['Pending', 'Shipped'].includes(order.status)) {
      return res.status(400).send('Order cannot be cancelled at this stage');
    }

    order.status = 'User Cancelled';
    order.cancellationReason = reason || 'No reason provided';
    await order.save();

    await Promise.all(order.products.map(async item => {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { stock: item.quantity }
      });
    }));

    if (req.user.role === 'admin') {
      res.redirect(`/admin/orders/${order.orderId}`);
    } else {
      res.redirect(`/orders/${order.orderId}`);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Cancellation failed');
  }
};

exports.processReturnRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).send('Return reason is required');
    }

    const order = await Order.findOne({ orderId });
    
    if (!order) {
      return res.status(404).send('Order not found');
    }

    if (order.status !== 'Delivered') {
      return res.status(400).send('Only delivered orders can be returned');
    }

    order.status = 'Returned';
    order.returnReason = reason;
    order.returnRequestDate = new Date();
    await order.save();

    if (req.user.role === 'admin') {
      res.redirect(`/admin/orders/${order.orderId}`);
    } else {
      res.redirect(`/orders/${order.orderId}`);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Return request failed');
  }
};


exports.adminCancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findOne({ orderId }).populate('products.product');
    
    if (!order) {
      return res.status(404).send('Order not found');
    }

    order.status = 'Cancelled';
    order.cancellationReason = reason || 'Admin cancellation';
    await order.save();

    await Promise.all(order.products.map(async item => {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { stock: item.quantity }
      });
    }));

    res.redirect(`/admin/orders/${order.orderId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Cancellation failed');
  }
};


module.exports = exports;

// OFFER MANAGEMENT
exports.listOffers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const totalOffers = await Offer.countDocuments();
    const offers = await Offer.find()
      .populate('products')
      .populate('categories')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalOffers / limit);

    res.render('admin/offers', {
      offers,
      currentPage: page,
      totalPages,
      messages: res.locals.messages || {} 
    });
  } catch (error) {
    console.error('Error listing offers:', error);
    
    req.session.messages = {
      error: 'Failed to load offers'
    };
    res.redirect('/admin/dashboard');
  }
};
// Render add offer form
exports.addOfferForm = async (req, res) => {
  try {
    const products = await Product.find({ isBlocked: false });
    const categories = await Category.find({
  $or: [
    { isDeleted: false },
    { isDeleted: { $exists: false } }  
  ]
});
    res.render('admin/add-offer', { 
      products, 
      categories,
      offerTypes: ['product', 'category', 'referral'],
      discountTypes: ['percentage', 'fixed'],
      
      success_msg: req.flash('success_msg')[0], 
      error_msg: req.flash('error_msg')[0]      
    });
  } catch (error) {
    console.error('Error loading add offer form:', error);
    req.flash('error_msg', 'Error loading form');
    res.redirect('/admin/offers');
  }
};
function normalizeToArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value]; 
}

// Create new offer
exports.createOffer = async (req, res) => {
  try {
    const {
      name, description, offerType, discountType, discountValue,
      startDate, endDate, products, categories,
      referralCode, referrerBonus, refereeBonus, minPurchaseAmount
    } = req.body;

    const selectedProducts = offerType === 'product' ? normalizeToArray(products) : [];
    const selectedCategories = offerType === 'category' ? normalizeToArray(categories) : [];

    
    if (offerType === 'product' && selectedProducts.length === 0) {
      req.flash('error_msg', 'Please select at least one product.');
      return res.redirect('/admin/offers/add');
    }

    if (offerType === 'category' && selectedCategories.length === 0) {
      req.flash('error_msg', 'Please select at least one category.');
      return res.redirect('/admin/offers/add');
    }

    const newOffer = new Offer({
      name: name.trim(),
      description,
      offerType,
      discountType,
      discountValue: parseInt(discountValue),
      startDate,
      endDate,
      isActive: true,
      products: selectedProducts,
      categories: selectedCategories,
      referralCode: offerType === 'referral' ? referralCode : undefined,
      referrerBonus: offerType === 'referral' ? referrerBonus : undefined,
      refereeBonus: offerType === 'referral' ? refereeBonus : undefined,
      minPurchaseAmount: offerType === 'referral' ? minPurchaseAmount : undefined
    });

    await newOffer.save();

    
    if (selectedProducts.length) {
      await Product.updateMany(
        { _id: { $in: selectedProducts } },
        { $addToSet: { offers: newOffer._id } }
      );
    }

    if (selectedCategories.length) {
      await Category.updateMany(
        { _id: { $in: selectedCategories } },
        { $addToSet: { offers: newOffer._id } }
      );
    }

    req.flash('success_msg', 'Offer created successfully');
    res.redirect('/admin/offers');

  } catch (err) {
    console.error('❌ Offer creation error:', err);
    req.flash('error_msg', 'Error creating offer');
    res.redirect('/admin/offers/add');
  }
};



// Edit offer form
exports.editOfferForm = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      req.flash('error', 'Offer not found.');
      return res.redirect('/admin/offers');
    }

    const products = await Product.find({ isBlocked: false });
    const categories = await Category.find({ isDeleted: false });

   // console.log('Offer fetched for editing:', offer); 

   res.render('admin/edit-offer', { 
  offer,
  products,
  categories,
  offerTypes: ['product', 'category', 'referral'],
  discountTypes: ['percentage', 'fixed'],
  selectedProducts: (offer.products || []).map(p => p.toString()),
  selectedCategories: (offer.categories || []).map(c => c.toString())
});

  } catch (error) {
    console.error('Error loading edit offer form:', error);
    res.status(500).send('Error loading form');
  }
};

// Update offer
exports.updateOffer = async (req, res) => {
  try {
    const {
      name, description, offerType, discountType, discountValue,
      startDate, endDate, products, categories,
      referralCode, referrerBonus, refereeBonus, minPurchaseAmount
    } = req.body;

    const offer = await Offer.findById(req.params.id);
    if (!offer) throw new Error('Offer not found');

   const selectedProducts = offerType === 'product' ? normalizeToArray(req.body.products) : [];
const selectedCategories = offerType === 'category' ? normalizeToArray(req.body.categories) : [];

    
    if (offer.offerType === 'product' && offer.products.length) {
      await Product.updateMany(
        { _id: { $in: offer.products } },
        { $pull: { offers: offer._id } }
      );
    }

    if (offer.offerType === 'category' && offer.categories.length) {
      await Category.updateMany(
        { _id: { $in: offer.categories } },
        { $pull: { offers: offer._id } }
      );
    }

    offer.name = name.trim();
    offer.description = description;
    offer.offerType = offerType;
    offer.discountType = discountType;
    offer.discountValue = discountValue;
    offer.startDate = startDate;
    offer.endDate = endDate;
    offer.isActive = req.body.hasOwnProperty('isActive');

    offer.products = selectedProducts;
    offer.categories = selectedCategories;

    if (offerType === 'referral') {
      offer.referralCode = referralCode;
      offer.referrerBonus = referrerBonus;
      offer.refereeBonus = refereeBonus;
      offer.minPurchaseAmount = minPurchaseAmount;
      offer.products = [];
      offer.categories = [];
    } else {
      offer.referralCode = undefined;
      offer.referrerBonus = undefined;
      offer.refereeBonus = undefined;
      offer.minPurchaseAmount = undefined;
    }

    await offer.save();

    if (selectedProducts.length) {
      await Product.updateMany(
        { _id: { $in: selectedProducts } },
        { $addToSet: { offers: offer._id } }
      );
    }

    if (selectedCategories.length) {
      await Category.updateMany(
        { _id: { $in: selectedCategories } },
        { $addToSet: { offers: offer._id } }
      );
    }

    req.flash('success', 'Offer updated successfully');
    res.redirect('/admin/offers');

  } catch (err) {
    console.error('❌ Offer update error:', err);
    req.flash('error', 'Error updating offer');
    res.redirect(`/admin/offers/edit/${req.params.id}`);
  }
};
// Toggle offer status
exports.toggleOfferStatus = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }
    
    offer.isActive = !offer.isActive;
    await offer.save();
    
    res.json({ 
      success: true, 
      isActive: offer.isActive,
      message: `Offer ${offer.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error toggling offer status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
};

// Delete offer
exports.deleteOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    
    if (offer.offerType === 'product' && offer.products.length > 0) {
      await Product.updateMany(
        { _id: { $in: offer.products } },
        { $pull: { offers: offer._id } }
      );
    } else if (offer.offerType === 'category' && offer.categories.length > 0) {
      await Category.updateMany(
        { _id: { $in: offer.categories } },
        { $pull: { offers: offer._id } }
      );
    }
    
    await Offer.findByIdAndDelete(req.params.id);
    
    req.flash('success', 'Offer deleted successfully');
    res.redirect('/admin/offers');
  } catch (error) {
    console.error('Error deleting offer:', error);
    req.flash('error', 'Error deleting offer');
    res.redirect('/admin/offers');
  }
};

// Show coupons page
exports.getCoupons = async (req, res) => {
  try {
    const perPage = 5;
    const page = parseInt(req.query.page) || 1;

    const totalCoupons = await Coupon.countDocuments();
    const totalPages = Math.ceil(totalCoupons / perPage);

    const coupons = await Coupon.find()
      .sort({ endDate: 1})
      .skip((page - 1) * perPage)
      .limit(perPage);

      res.render('admin/coupons',{
        coupons,
        currentPage: page,
        totalPages,
        messages: req.flash()
      });
  } catch (err) {
    console.error('Error Fetching coupons:',err);
    res.redirect('/admin/dashboard');
  }
};

// Create coupon
exports.createCoupon = async (req, res) => {
  try {
    const { code, discountType, discount, minPurchase, maxDiscount, startDate, endDate } = req.body;

    const trimmedCode = code.trim().toUpperCase();
    const coupons = await Coupon.find();

    const existingCoupon = await Coupon.findOne({ code: trimmedCode });
    if (existingCoupon) {
      return res.render('admin/coupons', {
        coupons,
        messages: { error: 'Coupon code already exists.' }
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return res.render('admin/coupons', {
        coupons,
        messages: { error: 'Start date must be before end date.' }
      });
    }

    const parsedDiscount = parseFloat(discount);
    const parsedMinPurchase = parseFloat(minPurchase) || 0;
    const parsedMaxDiscount = parseFloat(maxDiscount) || 0;

    if (discountType === 'percentage') {
      if (parsedDiscount < 1 || parsedDiscount > 90) {
        return res.render('admin/coupons', {
          coupons,
          messages: { error: 'Percentage discount must be between 1% and 90%.' }
        });
      }
    } else if (discountType === 'fixed') {
      if (parsedDiscount < 2000 || parsedDiscount > 50000) {
        return res.render('admin/coupons', {
          coupons,
          messages: { error: 'Fixed discount must be between ₹2000 and ₹50,000.' }
        });
      }
    }

    /*if (parsedMinPurchase < 2000) {
      return res.render('admin/coupons', {
        coupons,
      messages: { error: 'Minimum purchase amount must be at least 2000'} 
      });
    }
    if (parsedMaxDiscount < 2500) {
      return res.render('admin/coupons', {
        coupons,
        messages: {error: 'Maximum discount amount must be at least 2500'}
      });
    }*/

    const newCoupon = new Coupon({
      code: trimmedCode,
      discountType,
      discount: parsedDiscount,
      minPurchase: parsedMinPurchase,
      maxDiscount: parsedMaxDiscount,
      startDate: start,
      endDate: end
    });

    await newCoupon.save();

req.flash('success', 'Coupon added successfully!');
    return res.redirect('/admin/coupons');
  } catch (err) {
    console.error('Error creating coupon:', err.message);
    req.flash('error', 'Failed to create coupon. Please try again.');
    return res.redirect('/admin/coupons');
  }
};



// Delete coupon
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    await Coupon.findByIdAndDelete(id);
    req.flash('success', 'Coupon deleted');
    res.redirect('/admin/coupons');
  } catch (err) {
    console.error('Error deleting coupon:', err);
    req.flash('error', 'Failed to delete coupon.');
    res.redirect('/admin/coupons');
  }
};


//Report
exports.renderSalesReportPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const allOrders = await Order.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).populate('user', 'name');

    const totalOrders = allOrders.length;
    const totalPages = Math.ceil(totalOrders / limit);
    const paginatedOrders = allOrders.slice(skip, skip + limit);

    const summary = calculateSummary(allOrders);

    res.render('admin/salesReport', {
      orders: paginatedOrders,
      summary,
      startDate: startOfDay.toISOString().split('T')[0],
      endDate: endOfDay.toISOString().split('T')[0],
      currentPage: page,
      totalPages,
      filterType: "daily" 
    });
  } catch (err) {
    console.error('Error loading sales report:', err.message);
    res.status(500).send('Server error');
  }
};


exports.filterSalesReport = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const filterType = req.body.filterType || req.query.filterType || "custom"; 
    let { startDate, endDate } = req.body.startDate ? req.body : req.query;

    const today = new Date();

    if (filterType === "daily") {
      startDate = new Date(today.setHours(0, 0, 0, 0));
      endDate = new Date(today.setHours(23, 59, 59, 999));
    } 
    else if (filterType === "monthly") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      startDate = firstDay;
      endDate = new Date(lastDay.setHours(23, 59, 59, 999));
    } 
    else if (filterType === "yearly") {
      const firstDay = new Date(today.getFullYear(), 0, 1);
      const lastDay = new Date(today.getFullYear(), 11, 31);
      startDate = firstDay;
      endDate = new Date(lastDay.setHours(23, 59, 59, 999));
    } 
    else {
      if (!startDate || !endDate) {
        return res.status(400).send("Start and End Date are required for custom filter");
      }
      startDate = new Date(startDate);
      endDate = new Date(endDate);
      endDate.setHours(23, 59, 59, 999);
    }

    const allOrders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate("user", "name");

    const totalOrders = allOrders.length;
    const totalPages = Math.ceil(totalOrders / limit);
    const orders = allOrders.slice(skip, skip + limit);

    const summary = calculateSummary(allOrders);

    res.render("admin/salesReport", {
      orders,
      summary,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      currentPage: page,
      totalPages,
      filterType
    });
  } catch (err) {
    console.error("Filter Error:", err);
    res.status(500).send("Filter error");
  }
};



function calculateSummary(orders) {
  let totalSales = orders.length || 0;
  let totalAmount = 0;
  let totalDiscount = 0;

  orders.forEach(order => {
    totalAmount += order.totalAmount || 0;
    totalDiscount += (order.discountAmount || 0) + (order.couponDiscount || 0);
  });

  return {
    totalSales,
    totalAmount,
    totalDiscount
  };
}

exports.downloadSalesReportExcel = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).send('Start date and end date are required.');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); 

    const orders = await Order.find({
      createdAt: { $gte: start, $lte: end }
    }).populate('user', 'name');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sales Report');

    sheet.mergeCells('A1', 'E1');
    sheet.getCell('A1').value = 'Sales Report';
    sheet.getCell('A1').alignment = { horizontal: 'center' };
    sheet.getCell('A1').font = { size: 16, bold: true };

    sheet.mergeCells('A2', 'E2');
    sheet.getCell('A2').value = `From: ${moment(start).format('YYYY-MM-DD')} To: ${moment(end).format('YYYY-MM-DD')}`;
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    sheet.columns = [
      { header: 'User Name', key: 'userName', width: 25 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Amount (₹)', key: 'amount', width: 18 },
      { header: 'Discount (₹)', key: 'discount', width: 18 },
      { header: 'Coupon (₹)', key: 'coupon', width: 18 }
    ];

    let totalAmount = 0;
    let totalDiscount = 0;
    let totalCoupon = 0;

    orders.forEach(order => {
      const discount = order.discountAmount || 0;
      const coupon = order.couponDiscount || 0;
      const amount = order.totalAmount || 0;

      totalAmount += amount;
      totalDiscount += discount;
      totalCoupon += coupon;

      sheet.addRow({
        userName: order.user?.name || 'N/A',
        date: moment(order.createdAt).format('YYYY-MM-DD'),
        amount: amount.toFixed(2),
        discount: discount.toFixed(2),
        coupon: coupon.toFixed(2),
      });
    });

    sheet.addRow({});

    sheet.addRow(['Summary']);
    sheet.addRow([`Total Orders:`, orders.length]);
    sheet.addRow([`Total Sales Amount:`, '', '', '', `₹${totalAmount.toFixed(2)}`]);
    sheet.addRow([`Total Discounts (incl. coupon):`, '', '', '', `₹${(totalDiscount + totalCoupon).toFixed(2)}`]);

    const summaryTitleRow = sheet.getRow(sheet.lastRow.number - 3);
    summaryTitleRow.font = { bold: true, underline: true };

    const finalRows = [sheet.lastRow.number - 2, sheet.lastRow.number - 1];
    finalRows.forEach(rowNum => {
      const row = sheet.getRow(rowNum);
      row.font = { bold: true };
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=SalesReport.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('❌ Excel Report Generation Error:', err);
    res.status(500).send('Failed to generate sales report.');
  }
};

exports.downloadSalesReportPDF = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).send('Start and End Date are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const orders = await Order.find({ createdAt: { $gte: start, $lte: end } }).populate('user', 'name');

    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=SalesReport.pdf');
    doc.pipe(res);

    const logoPath = path.join(__dirname, '../public/images/logo1.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, 30, { width: 100 });
    }

    doc.moveDown(2);
    doc.fontSize(20).fillColor('#000000').text('Sales Report', { align: 'center' });
    doc.fontSize(12).fillColor('#555').text(`From: ${moment(start).format('YYYY-MM-DD')}   To: ${moment(end).format('YYYY-MM-DD')}`, { align: 'center' });
    doc.moveDown(1.5);

    let totalAmount = 0;
    let totalDiscount = 0;

    orders.forEach(order => {
      totalAmount += order.totalAmount;
      totalDiscount += (order.discountAmount || 0) + (order.couponDiscount || 0);
    });

    const generatedAt = moment().format('YYYY-MM-DD HH:mm:ss');

    doc
      .fontSize(12)
      .fillColor('#000')
      .font('Helvetica-Bold')
      .text('Summary', { underline: true });

    doc
      .moveDown(0.3)
      .font('Helvetica')
      .fontSize(11)
      .text(`Generated At: ${generatedAt}`)
      .text(`Total Orders: ${orders.length}`)
      .text(`Total Sales Amount: ₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
      .text(`Total Discounts (incl. coupon): ₹${totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);

    doc.moveDown(1.5);

    const tableTop = doc.y;
    const colSpacing = [90, 100, 90, 90, 90];

    const drawRow = (y, row, isHeader = false, alt = false) => {
      const fillColor = isHeader ? '#3f3f3f' : alt ? '#f8f8f8' : '#ffffff';

      doc
        .rect(40, y, 515, 20)
        .fill(fillColor)
        .fillColor(isHeader ? '#fff' : '#000')
        .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(10);

      let x = 45;
      row.forEach((text, i) => {
        doc.text(text, x, y + 5, {
          width: colSpacing[i],
          align: 'left',
        });
        x += colSpacing[i];
      });
    };

    drawRow(tableTop, ['User Name', 'Date', 'Amount (₹)', 'Discount (₹)', 'Coupon (₹)'], true);

    let y = tableTop + 20;
    orders.forEach((order, i) => {
      const alt = i % 2 === 0;
      const orderRow = [
        order.user?.name || 'N/A',
        moment(order.createdAt).format('YYYY-MM-DD'),
        order.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        (order.discountAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        (order.couponDiscount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      ];
      drawRow(y, orderRow, false, alt);
      y += 20;
    });

    doc.end();
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).send('Failed to generate PDF');
  }
};
exports.listAllPayments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const { paymentMethod, startDate, endDate } = req.query;

    let filter = {};

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const orders = await Order.find(filter)
      .populate("user")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalOrders = await Order.countDocuments(filter);

    res.render("admin/payments", {
      orders,
      totalPages: Math.ceil(totalOrders / limit),
      currentPage: page,
      paymentMethod: paymentMethod || '',
      startDate: startDate || '',
      endDate: endDate || ''
    });
  } catch (err) {
    console.error("Error fetching payments:", err);
    res.status(500).render("admin/500", { message: "Internal Server Error" });
  }
};



exports.viewPaymentDetails = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId)
      .populate("user")
      .populate("products.product");

    if (!order) {
      return res.status(404).render("admin/404", { message: "Order not found" });
    }

    res.render("admin/payment", { order }); 
  } catch (err) {
    console.error("Error fetching payment details:", err);
    res.status(500).render("admin/500", { message: "Internal Server Error" });
  }
};
