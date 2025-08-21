const Banner = require('../models/Banner');
const Category = require('../models/Category');
const path = require('path');
const fs = require('fs');

// GET all banners (Admin view)
exports.getBanners = async (req, res) => {
  try {
    // Fetch banners and populate category
    const banners = await Banner.find()
      .populate({
        path: 'category',
        select: 'name', // only fetch the name field
      });

    // Fetch all categories for the "Add Banner" form (ignore isDeleted)
    const categories = await Category.find({});

    console.log('Categories:', categories); // debug to see populated categories
    console.log('Banners:', banners); // debug to see banners

    res.render('admin/banners', { banners, categories });
  } catch (err) {
    console.error('Error fetching banners:', err);
    res.redirect('/admin/banners?error=FetchFailed');
  }
};


// POST add new banner
exports.addBanner = async (req, res) => {
  try {
    const { title, category } = req.body;
    if (!req.file) throw new Error('Banner image is required');

    const banner = new Banner({
      title,
      image: req.file.filename,
      category: category || null // null means "All Categories"
    });

    await banner.save();
    res.redirect('/admin/banners');
  } catch (err) {
    console.error('Error adding banner:', err);
    res.redirect('/admin/banners?error=UploadFailed');
  }
};

// DELETE banner
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.bannerId);
    if (!banner) return res.status(404).json({ error: 'Banner not found' });

    // Delete image file
    const imagePath = path.join(__dirname, '../public/uploads/banners', banner.image);
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

    await Banner.findByIdAndDelete(req.params.bannerId);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting banner:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
};
