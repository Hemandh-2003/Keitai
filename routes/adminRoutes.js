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
  blockProduct,
  unblockProduct,
  viewProductDetails,
getProductDetailsWithRelated ,  
  listOrders, 
  changeOrderStatus, 
  cancelOrder,
} = require('../controllers/adminController');
const { isAdmin } = require('../middleware/adminMiddleware');
const checkBlockedUser = require('../middleware/checkBlocked');
const multer = require('multer');
const path = require('path');
const adminController = require('../controllers/adminController');
const router = express.Router();
// Admin Login Route (GET)
router.get('/adminlog', (req, res) => {res.render('admin/login', { error: null });});

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
router.post('/products/block/:id', isAdmin, blockProduct);
router.post('/products/unblock/:id', isAdmin,unblockProduct);
router.get('/products/:productId',  getProductDetailsWithRelated );
router.delete('/products/delete-image/:filename', isAdmin,adminController.deleteImage);
router.delete('/products/delete-highlight/:filename', isAdmin,adminController.deleteHighlight);
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
router.post('/orders/update-status/:orderId', isAdmin, adminController.changeOrderStatus);
router.post('/orders/cancel/:orderId', isAdmin, cancelOrder);
router.post('/orders/:id/return-status', isAdmin, adminController.updateReturnStatus);


// Offer Management Routes
router.get('/offers', isAdmin, adminController.listOffers);
router.get('/offers/add', isAdmin, adminController.addOfferForm);
router.post('/offers/create', isAdmin, adminController.createOffer);
router.get('/offers/edit/:id', isAdmin, adminController.editOfferForm);
router.post('/offers/update/:id', isAdmin, adminController.updateOffer);
router.post('/offers/toggle-status/:id', isAdmin, adminController.toggleOfferStatus);
router.get('/offers/delete/:id', isAdmin, adminController.deleteOffer);

//Coupons management Routes
router.get('/coupons', isAdmin,adminController.getCoupons);
router.post('/coupons/create', isAdmin,adminController.createCoupon);
router.post('/coupons/edit/:id', isAdmin, adminController.editCoupon);
router.post('/coupons/delete/:id', isAdmin,adminController.deleteCoupon);

// Sales Report Routes
router.get('/sales-report', isAdmin,adminController.renderSalesReportPage);
router.post('/sales-report/filter', isAdmin,adminController.filterSalesReport);
router.get('/sales-report/filter', isAdmin,adminController.filterSalesReport); // 👈 Add this
router.post('/sales-report/download/excel', isAdmin,adminController.downloadSalesReportExcel);
router.post('/sales-report/download/pdf', isAdmin,adminController.downloadSalesReportPDF);

//dashboard
router.get('/api/dashboard-stats', isAdmin,adminController.getDashboardStats);

//payment
router.get('/payments', isAdmin,adminController.listAllPayments);
router.get('/orders/:id/payment', isAdmin,adminController.viewPaymentDetails);
module.exports = router;
