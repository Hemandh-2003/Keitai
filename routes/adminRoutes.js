const express = require('express');
const {
  adminDashboard,
  listUsers,
  blockUser,
  unblockUser,
  loadCategories,
  addCategory,
  deleteCategory,
  loadEditCategory,
  editCategory,
  listProducts,
  addProduct,
  createProduct,
  editProduct,
  updateProduct,
  deleteProduct,
  viewProductDetails,
  listOrders, // Add this method to list orders
  changeOrderStatus, // Add this for changing order status
  cancelOrder, // Add this for canceling orders
} = require('../controllers/adminController');
const { isAdmin } = require('../middleware/adminMiddleware');
const checkBlockedUser = require('../middleware/checkBlocked');
const multer = require('multer');
const path = require('path');

const router = express.Router();
// Admin Login Route (GET)
router.get('/adminlog', (req, res) => {
  res.render('admin/login', { error: null });
});

// Admin Login Route (POST)
router.post('/adminlog', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('admin/login', { error: 'Username and password are required.' });
  }

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    req.session.isAdmin = true;
    return res.redirect('/admin/dashboard');
  }

  res.render('admin/login', { error: 'Invalid credentials' });
});

// Admin Dashboard Route
router.get('/dashboard', isAdmin, adminDashboard);

// Order Management Routes
router.get('/orders', isAdmin, listOrders); // Route to list orders
router.post('/orders/update-status/:orderId', isAdmin, changeOrderStatus); // Route to change order status
router.post('/orders/cancel/:orderId', isAdmin, cancelOrder); // Route to cancel an order

// User Management Routes
router.get('/users', isAdmin, listUsers);
router.post('/block/:id', isAdmin, blockUser);
router.post('/unblock/:id', isAdmin, unblockUser);

// Category Management Routes
router.get('/categories', isAdmin, loadCategories);
router.post('/add-category', isAdmin, addCategory);
router.get('/delete-category/:id', isAdmin, deleteCategory);
router.get('/edit-category/:id', isAdmin, loadEditCategory);
router.post('/edit-category/:id', isAdmin, editCategory);

// Product Management Routes
router.get('/products', isAdmin, listProducts);
router.get('/products/add', isAdmin, addProduct);
router.post('/products/create', isAdmin, multer({ dest: './public/uploads' }).array('images', 8), createProduct);
router.get('/products/edit/:id', isAdmin, editProduct);
router.post('/products/update/:id', isAdmin, multer({ dest: './public/uploads' }).array('images', 8), updateProduct);
router.post('/products/delete/:id', isAdmin, deleteProduct);
router.get('/products/:id',  viewProductDetails);

// Admin Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.redirect('/admin/dashboard');
    }
    res.clearCookie('connect.sid');
    res.redirect('/admin/adminlog');
  });
});
//order Management Routes
router.get('/orders', isAdmin, listOrders);
router.post('/orders/update-status/:orderId', isAdmin, changeOrderStatus); 
router.post('/orders/cancel/:orderId', isAdmin, cancelOrder); 
router.get('/admin/orders', async (req, res) => {
  try {
    // Fetch orders from the database
    const orders = await Order.find().populate('userId').populate('productId').populate('selectedAddress');
    
    // Render orders page for admin, passing the orders data
    res.render('admin/orders', { orders });
  } catch (err) {
    console.error('Admin Orders Route - Error:', err.message);
    res.status(500).send('Internal Server Error');
  }
});


module.exports = router;
