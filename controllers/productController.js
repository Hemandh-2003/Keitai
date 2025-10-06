const Review = require('../models/review'); 
const Category = require('../models/Category');
const Product = require('../models/Product');
const {HTTP_STATUS}= require('../SM/status');
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
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Error loading products.');
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
    res.status(HTTP_STATUS.BAD_REQUEST).send('Error: ' + error.message);
  }
};



const fs = require('fs');
const path = require('path');

exports.editProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category');
    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).send('Product not found');
    }
    const categories = await Category.find({});
    res.render('admin/editProduct', { product, categories });
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Internal Server Error');
  }
};


exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(HTTP_STATUS.NOT_FOUND).send('Product not found');

    const categoryExists = await Category.findById(req.body.category);
    if (!categoryExists) return res.status(HTTP_STATUS.BAD_REQUEST).send('Invalid category');

    
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
      return res.status(HTTP_STATUS.BAD_REQUEST).send('Sales Price cannot be greater than Regular Price');
    }

    product.quantity = req.body.quantity;
    product.productOffer = req.body.productOffer || '';
    product.description = req.body.description || '';

    await product.save();
    res.redirect('/admin/products');

  } catch (error) {
    console.error('Update Product Error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Internal Server Error');
  }
};

exports.deleteImage = async (req, res) => {
  const { filename } = req.params;

  try {
    const product = await Product.findOne({ images: filename });

    if (!product) return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Product not found' });

    product.images = product.images.filter(img => img !== filename);
    await product.save();
    
    const filePath = path.join(__dirname, '../public/uploads', filename);
    fs.unlink(filePath, err => {
      if (err) console.log("File not deleted:", err);
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Delete image error:", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false });
  }
};

exports.deleteHighlight = async (req, res) => {
  const { filename } = req.params;

  try {
    const product = await Product.findOne({ highlights: filename });

    if (!product) return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Product not found' });

    product.highlights = product.highlights.filter(hl => hl !== filename);
    await product.save();

    const filePath = path.join(__dirname, '../public/uploads', filename);
    fs.unlink(filePath, err => {
      if (err) console.log("File not deleted:", err);
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Delete highlight error:", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false });
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
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Internal Server Error');
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
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Internal Server Error');
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
