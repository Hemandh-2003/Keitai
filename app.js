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

// Load environment variables
dotenv.config();

// Import Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');


// Initialize the app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(checkBlockedUser);
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

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
app.use('/cart', cartRoutes);

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Set views directory
app.set('views', path.join(__dirname, 'views'));

// Static files middleware (for CSS, JS, images, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Ensure the 'public/uploads' directory exists
const uploadDir = './public/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, './public/uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${path.basename(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      console.log('Uploading File:', file.originalname); // Log the file name being uploaded
      cb(null, './public/uploads');
    },
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${file.originalname}`;
      console.log('Generated Filename:', uniqueName); // Log the generated filename
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // Max file size: 10 MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only image files are allowed'), false);
    }
    console.log('File Type:', file.mimetype); // Log the file type being uploaded
    cb(null, true);
  },
});

// Route for creating a product
app.post(
  '/admin/products/create',
  upload.fields([
    { name: 'images', maxCount: 8 },
    { name: 'highlights', maxCount: 8 },
  ]),
  createProduct
);

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
app.use('/admin', adminRoutes); // Admin routes
app.use('/', authRoutes);       // Authentication-related routes
app.use('/user', userRoutes);   // User-specific routes
app.use('/admin', checkBlockedUser, adminRoutes); 
app.use('/admin', checkBlockedUser, adminRoutes); //user blocking
app.use('/wishlist', wishlistRoutes); //wish List

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

    const category = await Category.findOne({ slug });
    if (!category) {
      return res.status(404).render('user/404', { activePage: '404' });
    }

    // Building filter conditions
    const filterConditions = { category: category._id };
    if (brand) {
      filterConditions.brand = brand; // Assuming "brand" field exists in the Product schema
    }

    if (price) {
      if (price === 'below-50000') filterConditions.salesPrice = { $lt: 50000 };
      else if (price === '50000-100000') filterConditions.salesPrice = { $gte: 50000, $lte: 100000 };
      else if (price === 'above-100000') filterConditions.salesPrice = { $gt: 100000 };
    }

    // Sorting logic
    let sortCondition = {};
    if (sort === 'price-asc') sortCondition.salesPrice = 1;
    else if (sort === 'price-desc') sortCondition.salesPrice = -1;
    else if (sort === 'name-asc') sortCondition.name = 1;
    else if (sort === 'name-desc') sortCondition.name = -1;
 console.log("sort cond:",sortCondition)
    const products = await Product.find(filterConditions).sort(sortCondition);

    res.render(`user/${category.slug}`, {
      activePage: category.slug,
      category,
      products,
      query: req.query, // Pass the query parameters to the view
    });
  } catch (error) {
    console.error('Error loading category page:', error);
    res.status(500).send('Server Error');
  }
});

// Search endpoint
app.get('/api/search', async (req, res) => {
  const { query } = req.query;
  console.log('Search query:', query);

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

    console.log('Products found:', products.map(p => ({ id: p._id, name: p.name })));
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
