const express = require('express');
const {
  adminDashboard, 
} = require('../controllers/adminController');
const adminOrderController= require('../controllers/adminOrderController');
const adminUserController= require('../controllers/adminUserController');
const adminCategoryController= require('../controllers/adminCategoryController');
const offerController= require('../controllers/offerController');
const couponController= require('../controllers/couponController');
const productController= require('../controllers/productController')
const salesReportController= require('../controllers/salesReportController');
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
router.get('/orders', isAdmin, adminOrderController.listOrders); 
router.post('/orders/update-status/:orderId', isAdmin,adminOrderController.changeOrderStatus); 
router.post('/orders/cancel/:orderId', isAdmin, adminOrderController.cancelOrder); 

// User Management Routes
router.get('/users', isAdmin, adminUserController.listUsers);
router.post('/block/:id', isAdmin, adminUserController.blockUser);
router.post('/unblock/:id', isAdmin, adminUserController.unblockUser);

// Category Management Routes
router.get('/categories', isAdmin, adminCategoryController.loadCategories);
router.post('/add-category', isAdmin, adminCategoryController.addCategory);
router.get('/delete-category/:id', isAdmin, adminCategoryController.deleteCategory);
router.get('/edit-category/:id', isAdmin, adminCategoryController.loadEditCategory);
router.post('/edit-category/:id', isAdmin, adminCategoryController.editCategory);

// Product Management Routes
router.get('/products', isAdmin, productController.listProducts);
router.get('/products/add', isAdmin, productController.addProduct);
router.post('/products/create', isAdmin, multer({ dest: './public/uploads' }).array('images', 8), productController.createProduct);
router.get('/products/edit/:id', isAdmin, productController.editProduct);
router.post('/products/update/:id', isAdmin, multer({ dest: './public/uploads' }).array('images', 8), productController.updateProduct);
router.post('/products/block/:id', isAdmin, productController.blockProduct);
router.post('/products/unblock/:id', isAdmin,productController.unblockProduct);
router.get('/products/:productId',  productController.getProductDetailsWithRelated );
router.delete('/products/delete-image/:filename', isAdmin,productController.deleteImage);
router.delete('/products/delete-highlight/:filename', isAdmin,productController.deleteHighlight);
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
router.get('/orders', isAdmin, adminOrderController.listOrders);
router.post('/orders/update-status/:orderId', isAdmin, adminOrderController.changeOrderStatus);
router.post('/orders/cancel/:orderId', isAdmin, adminOrderController.cancelOrder);
router.post('/orders/:id/return-status', isAdmin, adminOrderController.updateReturnStatus);


// Offer Management Routes
router.get('/offers', isAdmin, offerController.listOffers);
router.get('/offers/add', isAdmin, offerController.addOfferForm);
router.post('/offers/create', isAdmin, offerController.createOffer);
router.get('/offers/edit/:id', isAdmin, offerController.editOfferForm);
router.post('/offers/update/:id', isAdmin, offerController.updateOffer);
router.post('/offers/toggle-status/:id', isAdmin, offerController.toggleOfferStatus);
router.get('/offers/delete/:id', isAdmin, offerController.deleteOffer);

//Coupons management Routes
router.get('/coupons', isAdmin,couponController.getCoupons);
router.post('/coupons/create', isAdmin,couponController.createCoupon);
router.post('/coupons/edit/:id', isAdmin, couponController.editCoupon);
router.post('/coupons/delete/:id', isAdmin,couponController.deleteCoupon);

// Sales Report Routes
router.get('/sales-report', isAdmin,salesReportController.renderSalesReportPage);
router.post('/sales-report/filter', isAdmin,salesReportController.filterSalesReport);
router.get('/sales-report/filter', isAdmin,salesReportController.filterSalesReport); 
router.post('/sales-report/download/excel', isAdmin,salesReportController.downloadSalesReportExcel);
router.post('/sales-report/download/pdf', isAdmin,salesReportController.downloadSalesReportPDF);

//dashboard
router.get('/api/dashboard-stats', isAdmin,adminController.getDashboardStats);

//payment
router.get('/payments', isAdmin,adminController.listAllPayments);
router.get('/orders/:id/payment', isAdmin,adminController.viewPaymentDetails);
module.exports = router;
