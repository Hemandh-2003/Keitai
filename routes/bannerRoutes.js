const express = require('express');
const router = express.Router();
const multer = require('multer');
const { isAdmin } = require('../middleware/adminMiddleware');
const BannerController = require('../controllers/bannerController');

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/banners'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// Admin: view all banners
router.get('/admin/banners', isAdmin, BannerController.getBanners);

// Admin: add banner
router.post('/admin/banners/add', isAdmin, upload.single('image'), BannerController.addBanner);

// Admin: delete banner
router.delete('/admin/banners/:bannerId', isAdmin, BannerController.deleteBanner);

module.exports = router;
