const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const path = require('path');
const passport = require('passport');
const fs = require('fs');
require('./config/passport');
require('dotenv').config();
const multer = require('multer');
const Category = require('./models/Category');
const Product = require('./models/Product');
const cartRoutes = require('./routes/cartRoutes');
const { createProduct } = require('./controllers/adminController');
const checkBlockedUser = require('./middleware/checkBlocked');
const paymentRoutes = require('./routes/paymentRoutes');
const methodOverride = require('method-override');
const reviewRoutes = require('./routes/reviewRoutes');
const bannerRoutes = require('./routes/bannerRoutes');
const Banner = require('./models/Banner');
// Load environment variables
dotenv.config();

// Import Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const wishlistIdsMiddleware = require('./middleware/wishlistIds');
const Wishlist = require('./models/Wishlist');

// Initialize the app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(checkBlockedUser);
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(wishlistIdsMiddleware);
// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // Use HTTPS in production
      httpOnly: true, // Ensures cookie can't be accessed by JavaScript
      maxAge: 24 * 60 * 60 * 1000, // 1 day expiry
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Flash messages middleware
app.use(flash());
app.use((req, res, next) => {
  res.locals.messages = {
    success: req.flash('success'),
    error: req.flash('error'),
    warning: req.flash('warning'),
    info: req.flash('info')
  };
  next();
});
app.use('/', reviewRoutes);
app.use('/cart', cartRoutes);
app.use('/', bannerRoutes);

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Set views directory
app.set('views', path.join(__dirname, 'views'));

// Static files middleware (for CSS, JS, images, etc.)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/payment', paymentRoutes);
app.use(methodOverride('_method'));
// Ensure the 'public/uploads' directory exists
const uploadDir = './public/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    //console.log('Uploading File:', file.originalname);
    cb(null, path.join(__dirname, 'public/uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    //console.log('Generated Filename:', uniqueName);
    cb(null, uniqueName);
  },
});

// Multer config with file type check
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.mimetype)) {
      //console.log('Rejected File Type:', file.mimetype);
      return cb(new Error('Only JPG, PNG, or WEBP images are allowed'), false);
    }
    cb(null, true);
  },
});

// Route for creating a product
const uploadFields = upload.fields([
  { name: 'images', maxCount: 8 },
  { name: 'highlights', maxCount: 8 },
]);

app.post('/admin/products/create', (req, res, next) => {
  uploadFields(req, res, function (err) {
    if (err instanceof multer.MulterError || (err && err.message.includes('Only JPG'))) {
      const message = encodeURIComponent('Only JPG, PNG, or WEBP images are allowed.');
      return res.redirect(`/admin/products?error=${message}`);
    } else if (err) {
      console.error('Upload error:', err);
      return res.status(500).send('Upload Error');
    }
    next(); // Proceed to controller
  });
}, createProduct);



// Fetch categories from database and pass to all pages
const fetchCategories = async () => {
  try {
    const categories = await Category.find();
    return categories;
  } catch (err) {
    console.error('Error fetching categories:', err);
    return [];
  }
};

// Middleware to fetch categories and make them available on all routes
app.use(async (req, res, next) => {
  const categories = await fetchCategories();
  res.locals.categories = categories;
  next();
});

// Routes
app.use('/admin', checkBlockedUser, adminRoutes);
app.use('/review', reviewRoutes); // Mount admin routes once with middleware
app.use('/', authRoutes);
app.use('/user', userRoutes);
app.use('/wishlist', wishlistRoutes);
// Home route
app.get('/', (req, res) => {
  res.render('user/index', { activePage: 'index' });
});
app.get('/product/:productId', async (req, res) => {
  try {
    // Redirect to the user route version
    res.redirect(`/user/product/${req.params.productId}`);
  } catch (error) {
    console.error('Redirect error:', error);
    res.status(500).send('Server Error');
  }
});
// Dynamic category route (Slug-based)
app.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { sort, brand, price } = req.query;

    // 1️⃣ Fetch the category
    const category = await Category.findOne({ slug });
    if (!category) {
      return res.status(404).render('user/404', { activePage: '404' });
    }

    // 2️⃣ Fetch banners for this category
    const banners = await Banner.find({ category: category._id });

    // 3️⃣ Build product filter conditions
    const filterConditions = { category: category._id };
    if (brand) filterConditions.brand = brand;

    if (price) {
      if (price === 'below-50000') filterConditions.salesPrice = { $lt: 50000 };
      else if (price === '50000-100000') filterConditions.salesPrice = { $gte: 50000, $lte: 100000 };
      else if (price === 'above-100000') filterConditions.salesPrice = { $gt: 100000 };
    }

    // 4️⃣ Sorting logic
    let sortCondition = {};
    if (sort === 'price-asc') sortCondition.salesPrice = 1;
    else if (sort === 'price-desc') sortCondition.salesPrice = -1;
    else if (sort === 'name-asc') sortCondition.name = 1;
    else if (sort === 'name-desc') sortCondition.name = -1;

    // 5️⃣ Fetch products
    const products = await Product.find(filterConditions)
      .sort(sortCondition)
      .populate('offers')
      .populate('category');

    // 6️⃣ Fetch wishlist if user logged in
    let wishlist = [];
    const userId = req.session.user || null;
    if (userId) {
      wishlist = await Wishlist.findOne({ user: userId._id }).populate('products');
    }

    // 7️⃣ Apply offer calculations
    const productsWithOffers = await Promise.all(products.map(async (product) => {
      const offerDetails = await product.getBestOfferPrice();
      return { ...product.toObject(), offerDetails };
    }));

    // 8️⃣ Render the category page with banners
    res.render(`user/${category.slug}`, {
      activePage: category.slug,
      category,
      products: productsWithOffers,
      query: req.query,
      wishlist,
      banners // ✅ pass banners to template
    });

  } catch (error) {
    console.error('Error loading category page:', error);
    res.status(500).send('Server Error');
  }
});


// Search endpoint
app.get('/api/search', async (req, res) => {
  const { query } = req.query;
  //console.log('Search query:', query);

  try {
    const products = await Product.find({
      $or: [
        { name: { $regex: query, $options: 'i' } }, // Case-insensitive regex
        { description: { $regex: query, $options: 'i' } },
        { brand: { $regex: query, $options: 'i' } }
      ],
      isBlocked: false,
      isDeleted: false
    })
      .limit(10)
      .populate('category');

    //console.log('Products found:', products.map(p => ({ id: p._id, name: p.name })));
    res.json(products);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Admin products route
app.get('/admin/products', async (req, res) => {
  const categories = await Category.find();
  const products = await Product.find().populate('category');
  res.render('admin/products', { categories, products });
});

// Admin: Add product page
app.get('/admin/products/add', async (req, res) => {
  const categories = await Category.find({ isDeleted: false });
  res.render('admin/add-product', { categories });
});

// Database connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('Database connection error:', err));

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
