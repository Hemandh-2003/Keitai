const razorpay = require('../config/razorpay');
const User = require('../models/User');
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
exports.getDashboardStats = async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;

    let match = { status: { $ne: 'Cancelled' } };

    // Date filter
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

    // Aggregation for total sales and orders
    const orders = await Order.find(match).populate('products.product');
    const sales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const orderCount = orders.length;

    // Top products by quantity sold
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

    // Top categories by number of products
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
    const page = parseInt(req.query.page) || 1;
    const limit = 10; 
    const skip = (page - 1) * limit;

    // Build the query filter based on the selected sort option
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

    // Get the total count of users matching the filter
    const totalUsers = await User.countDocuments(filter);

    // Get the users for the current page
    const users = await User.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Calculate the total number of pages
    const totalPages = Math.ceil(totalUsers / limit);

    // Render the users page with the users data and pagination details
    res.render('admin/users', {
      users,
      sortBy,
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
    // Block the user in the database
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: true });

    // Update the session if the blocked user is the logged-in user
    if (req.session.userId === user._id.toString()) {
      req.session.isBlocked = true; // Set session variable indicating the user is blocked
    }

    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).send('Error blocking user');
  }
};


exports.unblockUser = async (req, res) => {
  try {
    // Unblock the user in the database
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: false });

    // Update the session if the unblocked user is the logged-in user
    if (req.session.userId === user._id.toString()) {
      req.session.isBlocked = false; // Set session variable to false for unblocked user
    }

    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).send('Error unblocking user');
  }
};


// Category management

// Load the categories page
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
    const slug = name.toLowerCase().replace(/\s+/g, '-'); // Generate slug from name

    // Check if the category already exists
    const existingCategory = await Category.findOne({ name: name.toLowerCase() });
    if (existingCategory) {
      const categories = await Category.find(); // Fetch categories to display
      return res.render('admin/categories', {
        categories,
        error: 'This category already exists in the list.', // Pass error message
      });
    }

    // Save the new category
    const newCategory = new Category({ name, slug });
    await newCategory.save();

    res.redirect('/admin/categories');
  } catch (error) {
    console.error('Error adding category:', error);
    
    // Render categories page with a generic error message
    const categories = await Category.find(); // Fetch categories to display
    return res.render('admin/categories', {
      categories,
      error: 'Yo Look the List below Please, That category is persent ', // Custom error message
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

// Edit a category (GET and POST)
exports.loadEditCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    res.render('admin/edit-category', { category });
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

    // Check if the new category name already exists
    const existingCategory = await Category.findOne({ slug });
    if (existingCategory && existingCategory._id.toString() !== id) {
      return res.status(400).render('admin/edit-category', {
        errorMessage: 'Category name already exists.',
        category: { name }  // Retain the old category name in case of error
      });
    }

    // Update the category if no error
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
    // Get the category ID from query parameters (if available)
    const categoryId = req.query.category || '';

    // Get the current page from query parameters, defaulting to page 1
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Number of products per page
    const skip = (page - 1) * limit; // Skip the products for the previous pages

    // Find categories for the dropdown
    const categories = await Category.find();

    // Find total count of products (filtered by category if needed)
    let totalProducts;
    if (categoryId) {
      totalProducts = await Product.countDocuments({ category: categoryId, isDeleted: false });
    } else {
      totalProducts = await Product.countDocuments({ isDeleted: false });
    }

    // Calculate the total number of pages
    const totalPages = Math.ceil(totalProducts / limit);

    // Fetch the products for the current page
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

    // Render the products page with pagination info
    res.render('admin/products', {
      products,
      categories,
      selectedCategory: categoryId,
      currentPage: page,
      totalPages: totalPages,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send('Error loading products.');
  }
};

// Render add product form
exports.addProduct = async (req, res) => {
  const categories = await Category.find({ isDeleted: false });
  res.render('admin/products', { categories }); // Ensure addProduct.ejs matches this route
};

// Create a new product
exports.createProduct = async (req, res) => {
  try {
    // Debugging: Log the incoming request body and files
   /* console.log('Request Body:', req.body);
    console.log('Uploaded Images:', req.files.images);
    console.log('Uploaded Highlights:', req.files.highlights);*/

    // Extract and process uploaded files
    const images = req.files.images ? req.files.images.map((file) => file.filename) : [];
    const highlights = req.files.highlights ? req.files.highlights.map((file) => file.filename) : [];

    // Debugging: Log the processed filenames
   /* console.log('Processed Images:', images);
    console.log('Processed Highlights:', highlights);*/

    // Validate the number of images and highlights
    if (images.length > 4) {
      throw new Error('You can upload up to 4 product images only.');
    }
    if (highlights.length > 4) {
      throw new Error('You can upload up to 4 product highlights only.');
    }

    // Debugging: Log product data before saving
   /* console.log('Product Data:', {
      name: req.body.name,
      category: req.body.category,
      brand: req.body.brand,
      regularPrice: req.body.regularPrice,
      salesPrice: req.body.salesPrice || null,
      quantity: req.body.quantity,
      productOffer: req.body.productOffer || '',
      isBlocked: req.body.isBlocked || false,
      images: images, // Array of image filenames
      highlights: highlights, // Array of highlight filenames
      description: req.body.description || '',
    });*/

    // Save the product in the database
    const product = await new Product({
      name: req.body.name,
      category: req.body.category,
      brand: req.body.brand,
      regularPrice: req.body.regularPrice,
      salesPrice: req.body.salesPrice || null,
      quantity: req.body.quantity,
      productOffer: req.body.productOffer || '',
      isBlocked: req.body.isBlocked || false,
      images: images, // Array of image filenames
      highlights: highlights, // Array of highlight filenames
      description: req.body.description || '',
    }).save();

    // Debugging: Log the saved product
    //console.log('Product Saved:', product);

    res.redirect('/admin/products');
  } catch (error) {
    console.error('Error:', error);
    res.status(400).send('Error creating product: ' + error.message);
  }
};


/*router.get('/products/:id', async (req, res) => {
  try {
      const product = await Product.findById(req.params.id).populate('category');
      if (!product) {
          return res.status(404).send('Product not found');
      }
      res.render('product-details', { product });
  } catch (error) {
      console.error(error);
      res.status(500).send('Error loading product details');
  }
});*/


// Render edit product form
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

// Update an existing product
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).send('Product not found');
    }

    // Validate category
    const categoryExists = await Category.findById(req.body.category);
    if (!categoryExists) {
      return res.status(400).send('Invalid category');
    }

    // Handle file uploads
    const imagePaths = req.files && req.files.length > 0
      ? req.files.map((file) => file.filename)
      : product.images;

    // Remove old images if new ones are uploaded
    if (req.files && req.files.length > 0) {
      product.images.forEach((oldImage) => {
        const oldImagePath = path.join(__dirname, '..', 'uploads', oldImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath); // Delete old image file
        }
      });
    }

    // Update product fields
    product.name = req.body.name;
    product.category = req.body.category;
    product.brand = req.body.brand;
    product.regularPrice = req.body.regularPrice;
    product.salesPrice = req.body.salesPrice || null;

    // Ensure salesPrice is not higher than regularPrice
    if (product.salesPrice && product.salesPrice > product.regularPrice) {
      return res.status(400).send('Sales Price cannot be greater than Regular Price');
    }

    product.quantity = req.body.quantity;
    product.productOffer = req.body.productOffer || '';
    product.isBlocked = req.body.isBlocked || false;
    product.images = imagePaths;
    product.description = req.body.description || '';

    // Save the updated product
    await product.save();
    res.redirect('/admin/products');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
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

    const product = await Product.findOne({
      _id: productId,
      isBlocked: false
    })
      .populate('category')
      .populate('offers');

    if (!product) {
      return res.status(404).send('Product not found');
    }

    // 🛠️ Calculate best offer from product + category
    const offerDetails = await product.getBestOfferPrice();

    // ✅ Attach offer details directly to product (useful for EJS)
    product.offerDetails = offerDetails;

    // Fetch related products
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId },
      isBlocked: false
    }).limit(4).populate('offers category');

    // ✅ Calculate offerDetails for related products too
    for (const related of relatedProducts) {
      related.offerDetails = await related.getBestOfferPrice();
    }

    res.render('user/Product-details', {
      user: req.session.user,
      product,
      relatedProducts,
      offerDetails,
      finalPrice: offerDetails.price
    });

  } catch (error) {
    console.error('Error in product details:', error);
    res.status(500).send('Server Error');
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
    const { action } = req.body; // 'Approved' or 'Rejected'

    if (!['Approved', 'Rejected'].includes(action)) {
      return res.status(400).send('Invalid action');
    }

    const order = await Order.findById(orderId).populate('user').populate('returnedItems.product');

    if (!order || !order.returnRequested || order.returnStatus !== 'Requested') {
      return res.status(400).send('Invalid return request');
    }

    order.returnStatus = action;
    order.returnRequested = false;
    order.statusHistory.push({
      status: `Return ${action}`,
      updatedAt: new Date(),
    });

    // ✅ If approved, calculate refund and add to user's wallet
    if (action === 'Approved') {
      let refundAmount = 0;

      for (const item of order.returnedItems) {
        const matchedProduct = order.products.find(
          p => p.product.toString() === item.product._id.toString()
        );

        const unitPrice = matchedProduct?.salesPrice || matchedProduct?.regularPrice || 0;
        refundAmount += unitPrice * item.quantity;
      }

      // ✅ Update user wallet
      const user = order.user;
      user.wallet.balance += refundAmount;
      user.wallet.transactions.push({
        type: 'Credit',
        amount: refundAmount,
        reason: 'Refund for returned items',
        orderId: order._id,
      });

      await user.save();
    }

    await order.save();
    res.redirect('/admin/orders?sort=return-requested');

  } catch (err) {
    console.error('❌ Error updating return status:', err);
    res.status(500).send('Server error');
  }
};


// Cancel Order
exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId }).populate('products.product').exec();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Mark as cancelled
    order.status = 'Cancelled';
    await order.save();

    // Restore product quantity
    const bulkOps = order.products.map(item => ({
      updateOne: {
        filter: { _id: item.product._id },
        update: { $inc: { quantity: item.quantity } }
      }
    }));
    if (bulkOps.length > 0) await Product.bulkWrite(bulkOps);

    // Refund to user's wallet
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
      /*payment_capture: 1*/
    };

   // console.log("📦 Razorpay Options:", options);

    const razorpayOrder = await razorpay.orders.create(options);
    

    order.paymentMethod = 'Online';
    order.razorpayOrderId = razorpayOrder.id;
    order.amount=razorpayOrder.amount;
    await order.save();
    console.log(razorpayOrder)

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

    // Verify the signature (in production)
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).send('Payment verification failed');
    }

    order.paymentStatus = 'Paid';
    order.razorpayPaymentId = razorpay_payment_id;
    order.status = 'Pending'; // Change from 'Paid' to 'Pending' as per your order flow
    await order.save();

    res.redirect(`/payment/success/${order.orderId}`);
  } catch (err) {
    console.error(err);
    res.redirect('/payment/failed');
  }
};

// ====== ORDER MANAGEMENT ====== //

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
      isAdmin: true // Flag to show admin-specific controls
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

    // Validate order can be cancelled
    if (!['Pending', 'Shipped'].includes(order.status)) {
      return res.status(400).send('Order cannot be cancelled at this stage');
    }

    // Update order status
    order.status = 'User Cancelled';
    order.cancellationReason = reason || 'No reason provided';
    await order.save();

    // Restore product quantities
    await Promise.all(order.products.map(async item => {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { stock: item.quantity }
      });
    }));

    // Redirect based on user type
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

    // Redirect based on user type
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

// ====== ADMIN ORDER ACTIONS ====== //

exports.adminCancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findOne({ orderId }).populate('products.product');
    
    if (!order) {
      return res.status(404).send('Order not found');
    }

    // Update order status
    order.status = 'Cancelled';
    order.cancellationReason = reason || 'Admin cancellation';
    await order.save();

    // Restore product quantities
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

exports.approveReturn = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).send('Order not found');

    if (order.status !== 'Returned') {
      return res.status(400).send('Order is not marked for return');
    }

    order.returnStatus = 'Approved';
    order.returnApprovalDate = new Date();
    await order.save();

    // Refund to user's wallet
    const user = await User.findById(order.user);
    const refundAmount = order.totalAmount;

    user.wallet.balance += refundAmount;
    user.wallet.transactions.push({
      type: 'Credit',
      amount: refundAmount,
      reason: 'Return Approved',
      orderId: order._id,
    });
    await user.save();

    res.redirect(`/admin/orders/${order.orderId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Return approval failed');
  }
};


// [Keep all your remaining existing methods...]

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

    // Combine any existing res.locals.messages with your view data
    res.render('admin/offers', {
      offers,
      currentPage: page,
      totalPages,
      messages: res.locals.messages || {} // Ensure messages exists
    });
  } catch (error) {
    console.error('Error listing offers:', error);
    // Set error message in session for next request
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
    { isDeleted: { $exists: false } }  // <-- include docs without this field
  ]
});
    res.render('admin/add-offer', { 
      products, 
      categories,
      offerTypes: ['product', 'category', 'referral'],
      discountTypes: ['percentage', 'fixed'],
      // Pass flash messages to the template
      success_msg: req.flash('success_msg')[0], // Get first success message
      error_msg: req.flash('error_msg')[0]      // Get first error message
    });
  } catch (error) {
    console.error('Error loading add offer form:', error);
    req.flash('error_msg', 'Error loading form');
    res.redirect('/admin/offers');
  }
};

// Create new offer
exports.createOffer = async (req, res) => {
  console.log('➡️ createOffer body:', req.body); // Inspect posted values

  try {
    let {
      name, description, offerType, discountType, discountValue,
      startDate, endDate, products, categories,
      referralCode, referrerBonus, refereeBonus, minPurchaseAmount
    } = req.body;

    // Normalize arrays
    const selectedProducts = Array.isArray(products)
      ? products : products ? [products] : [];

    const selectedCategories = Array.isArray(categories)
      ? categories : categories ? [categories] : [];
    discountValue=parseInt(discountValue)
    console.log("disocunt value:",discountValue)
    const newOffer = new Offer({
      name, description, offerType, discountType, discountValue,
      startDate, endDate, isActive: true
    });

    // Handle offer types
    if (offerType === 'product') {
      newOffer.products = selectedProducts;
    } else if (offerType === 'category') {
      newOffer.categories = selectedCategories;
    } else if (offerType === 'referral') {
      newOffer.referralCode = referralCode;
      newOffer.referrerBonus = referrerBonus;
      newOffer.refereeBonus = refereeBonus;
      newOffer.minPurchaseAmount = minPurchaseAmount;
    }

    await newOffer.save();

    // Attach offer to categories/products
    if (offerType === 'product' && selectedProducts.length) {
      await Product.updateMany({ _id: { $in: selectedProducts } }, { $push: { offers: newOffer._id } });
    } else if (offerType === 'category' && selectedCategories.length) {
      await Category.updateMany({ _id: { $in: selectedCategories } }, { $push: { offers: newOffer._id } });
    }

    req.flash('success_msg', 'Offer created successfully');
    return res.redirect('/admin/offers');
  } catch (err) {
    console.error('❌ Offer creation error:', err.message);
    req.flash('error_msg', 'Error creating offer');
    return res.redirect('/admin/offers/add');
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

    console.log('Offer fetched for editing:', offer); // Optional log

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
      name, 
      description, 
      offerType, 
      discountType, 
      discountValue,
      startDate,
      endDate,
      isActive,
      products,
      categories,
      referralCode,
      referrerBonus,
      refereeBonus,
      minPurchaseAmount
    } = req.body;

    const offer = await Offer.findById(req.params.id);
    
    // Remove offer from previously associated products/categories
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

    // Update offer fields
    offer.name = name;
    offer.description = description;
    offer.offerType = offerType;
    offer.discountType = discountType;
    offer.discountValue = discountValue;
    offer.startDate = startDate;
    offer.endDate = endDate;
   offer.isActive = req.body.hasOwnProperty('isActive');

    // Handle different offer types
    if (offerType === 'product') {
      offer.products = products || [];
      offer.categories = [];
      offer.referralCode = undefined;
      offer.referrerBonus = undefined;
      offer.refereeBonus = undefined;
      offer.minPurchaseAmount = undefined;
    } else if (offerType === 'category') {
      offer.categories = categories || [];
      offer.products = [];
      offer.referralCode = undefined;
      offer.referrerBonus = undefined;
      offer.refereeBonus = undefined;
      offer.minPurchaseAmount = undefined;
    } else if (offerType === 'referral') {
      offer.referralCode = referralCode;
      offer.referrerBonus = referrerBonus;
      offer.refereeBonus = refereeBonus;
      offer.minPurchaseAmount = minPurchaseAmount;
      offer.products = [];
      offer.categories = [];
    }

    await offer.save();

    // Add offer to newly associated products/categories
    if (offer.offerType === 'product' && offer.products.length > 0) {
      await Product.updateMany(
        { _id: { $in: offer.products } },
        { $push: { offers: offer._id } }
      );
    } else if (offer.offerType === 'category' && offer.categories.length > 0) {
      await Category.updateMany(
        { _id: { $in: offer.categories } },
        { $push: { offers: offer._id } }
      );
    }

    req.flash('success', 'Offer updated successfully');
    res.redirect('/admin/offers');
  } catch (error) {
    console.error('Error updating offer:', error);
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
    
    // Remove offer from products/categories
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
    const coupons = await Coupon.find().sort({ endDate: 1 });

    res.render('admin/coupons', {
      coupons,
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.redirect('/admin/dashboard');
  }
};



// Create coupon
exports.createCoupon = async (req, res) => {
  try {
    const {
      code,
      discountType,
      discount,
      startDate,
      endDate
    } = req.body;

    console.log('Create request:', req.body);

    const existingCoupon = await Coupon.findOne({ code: code.trim().toUpperCase() });

    if (existingCoupon) {
      req.flash('error', 'Coupon code already exists.');
      return res.redirect('/admin/coupons');
    }

    if (new Date(startDate) > new Date(endDate)) {
      req.flash('error', 'Start date must be before end date.');
      return res.redirect('/admin/coupons');
    }

    const newCoupon = new Coupon({
      code: code.trim().toUpperCase(),
      discountType,
      discount: parseFloat(discount),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    await newCoupon.save();
    console.log('New coupon saved:', newCoupon);

    req.flash('success', 'Coupon added successfully!');
    res.redirect('/admin/coupons');
  } catch (err) {
    console.error('Error creating coupon:', err.message);
    req.flash('error', 'Failed to create coupon.');
    res.redirect('/admin/coupons');
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
    console.error(err);
    req.flash('error', 'Failed to delete coupon');
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
      totalPages
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

    // Use req.body for POST or req.query for GET (pagination)
    const startDate = req.body.startDate || req.query.startDate;
    const endDate = req.body.endDate || req.query.endDate;

    if (!startDate || !endDate) {
      return res.status(400).send('Start and End Date are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const allOrders = await Order.find({ createdAt: { $gte: start, $lte: end } }).populate('user', 'name');

    const totalOrders = allOrders.length;
    const totalPages = Math.ceil(totalOrders / limit);
    const orders = allOrders.slice(skip, skip + limit); // client-side pagination

    const summary = calculateSummary(allOrders);

    res.render('admin/salesReport', {
      orders,
      summary,
      startDate,
      endDate,
      currentPage: page,
      totalPages
    });
  } catch (err) {
    console.error('Filter Error:', err);
    res.status(500).send('Filter error');
  }
};


function calculateSummary(orders) {
  let totalSales = orders.length;
  let totalAmount = 0;
  let totalDiscount = 0;

  orders.forEach(order => {
    totalAmount += order.totalAmount;
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
      return res.status(400).send("Start date and end date are required.");
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include the full end day

    const orders = await Order.find({
      createdAt: { $gte: start, $lte: end }
    }).populate('user', 'name'); 

    console.log("📦 Orders found:", orders.length);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sales Report');

   sheet.columns = [
  { header: 'User Name', key: 'userName' },
  { header: 'Date', key: 'date' },
  { header: 'Amount', key: 'amount' },
  { header: 'Discount', key: 'discount' },
  { header: 'Coupon Discount', key: 'coupon' },
];

    orders.forEach(order => {
     sheet.addRow({
  userName: order.user?.name || 'N/A',
  date: moment(order.createdAt).format('YYYY-MM-DD'),
  amount: order.totalAmount,
  discount: order.discountAmount || 0,
  coupon: order.couponDiscount || 0,
});
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=SalesReport.xlsx'
    );

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

    // Logo (optional)
    const logoPath = path.join(__dirname, '../public/images/logo1.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, 30, { width: 100 });
    }

    doc.moveDown(2);
    doc
      .fontSize(20)
      .fillColor('#000000')
      .text('Sales Report', { align: 'center' });

    doc
      .fontSize(12)
      .fillColor('#555')
      .text(`From: ${moment(start).format('YYYY-MM-DD')}   To: ${moment(end).format('YYYY-MM-DD')}`, {
        align: 'center'
      })
      .moveDown(1.2);

    // Table Headers
    const tableTop = doc.y;
    const colSpacing = [90, 100, 90, 90, 90];

    const drawRow = (y, row, isHeader = false, alt = false) => {
      const fillColor = isHeader
        ? '#3f3f3f'
        : alt
        ? '#f8f8f8'
        : '#ffffff';

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

    let totalAmount = 0;
    let totalDiscount = 0;

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

      totalAmount += order.totalAmount;
      totalDiscount += (order.discountAmount || 0) + (order.couponDiscount || 0);
    });

    // Summary section
    doc.moveDown(2);
    doc
      .fontSize(12)
      .fillColor('#000')
      .font('Helvetica-Bold')
      .text('Summary', { underline: true });

    doc
      .moveDown(0.5)
      .font('Helvetica')
      .fontSize(11)
      .text(`Total Orders: ${orders.length}`)
.text(`Total Sales Amount: ₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
.text(`Total Discounts (incl. coupon): ₹${totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    doc.end();
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).send('Failed to generate PDF');
  }
};
