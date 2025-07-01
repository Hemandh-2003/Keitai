const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Order = require('../models/Order');
exports.adminDashboard = (req, res) => {
  res.render('admin/dashboard');
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
    console.log('Request Body:', req.body);
    console.log('Uploaded Images:', req.files.images);
    console.log('Uploaded Highlights:', req.files.highlights);

    // Extract and process uploaded files
    const images = req.files.images ? req.files.images.map((file) => file.filename) : [];
    const highlights = req.files.highlights ? req.files.highlights.map((file) => file.filename) : [];

    // Debugging: Log the processed filenames
    console.log('Processed Images:', images);
    console.log('Processed Highlights:', highlights);

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
    console.log('Product Saved:', product);

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
    console.log('getProductsDetail')
    const productId = req.params.productId// Make sure this matches your route parameter
    console.log(productId)
    const product = await Product.findOne({
      _id: productId,
      isBlocked: false
    }).populate('category');
    // console.log(product)

    if (!product) {
      return res.status(404).send('Product not found');
    }

    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId },//
      isBlocked: false
    }).limit(4);
    console.log("related:",relatedProducts)

    res.render('user/Product-details', { 
      user: req.session.user, 
      product,
      relatedProducts 
    });

  } catch (error) {
    console.error('Error:', error);
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
    const page = parseInt(req.query.page) || 1; // Get the current page (default to 1)
    const limit = 5; // Number of orders per page
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
      default:
        sortCriteria = { createdAt: -1 };
    }

    const orders = await Order.find(filterCriteria)
      .sort(sortCriteria)
      .skip((page - 1) * limit) // Skip the appropriate number of orders
      .limit(limit) // Limit to 5 orders per page
      .populate('user')
      .populate('products.product')
      .exec();

    // Get the total count of orders to calculate total pages
    const totalOrders = await Order.countDocuments(filterCriteria);
    const totalPages = Math.ceil(totalOrders / limit); // Calculate total pages

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
    const { status } = req.body; // Expecting a status such as 'shipped', 'delivered', etc.

    const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true });
    res.redirect('/admin/orders');
  } catch (error) {
    console.error('Error changing order status:', error);
    res.status(500).send('Error changing order status');
  }
};

// Cancel Order
exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).send('Order not found');
    
    // Update the order status to 'Cancelled' for admin cancellations
    order.status = 'Cancelled'; // Change to 'Cancelled' instead of 'User Cancelled'
    await order.save();

    // Restore the stock quantity of the canceled products
    for (const item of order.products) {
      const product = await Product.findById(item.product);
      if (product) {
        product.quantity += item.quantity; // Restore stock
        await product.save();
      }
    }

    // Redirect the admin to the orders page after cancellation
    res.redirect('/admin/orders');
  } catch (error) {
    console.error('Error canceling order:', error);
    res.status(500).send('Error canceling order');
  }
};