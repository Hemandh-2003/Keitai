const Product = require('../models/Product');
const Category = require('../models/Category');
const Wishlist = require('../models/Wishlist');

// Get search results page
const getSearchResults = async (req, res) => {
  try {
    const { 
      q: query, 
      sort = 'relevance', 
      page = 1, 
      limit = 12,
      brand,
      price_min,
      price_max,
      category: categorySlug
    } = req.query;

    // Build search query
    let searchQuery = {
      isBlocked: false,
      isDeleted: false
    };

    // Add text search if query exists
    if (query && query.trim()) {
      searchQuery.$or = [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { brand: { $regex: query, $options: 'i' } }
      ];
    }

    // Add brand filter
    if (brand) {
      searchQuery.brand = { $regex: brand, $options: 'i' };
    }

    // Add price range filter
    if (price_min || price_max) {
      searchQuery.$and = searchQuery.$and || [];
      const priceFilter = {};
      if (price_min) priceFilter.$gte = parseFloat(price_min);
      if (price_max) priceFilter.$lte = parseFloat(price_max);
      searchQuery.$and.push({ salesPrice: priceFilter });
    }

    // Add category filter
    if (categorySlug) {
      const category = await Category.findOne({ slug: categorySlug });
      if (category) {
        searchQuery.category = category._id;
      }
    }

    // Build sort object
    let sortObj = {};
    switch (sort) {
      case 'price-asc':
        sortObj = { salesPrice: 1 };
        break;
      case 'price-desc':
        sortObj = { salesPrice: -1 };
        break;
      case 'name-asc':
        sortObj = { name: 1 };
        break;
      case 'name-desc':
        sortObj = { name: -1 };
        break;
      case 'newest':
        sortObj = { createdAt: -1 };
        break;
      case 'oldest':
        sortObj = { createdAt: 1 };
        break;
      default: // relevance
        if (query && query.trim()) {
          // For relevance, we'll use text score if available, otherwise by name
          sortObj = { name: 1 };
        } else {
          sortObj = { createdAt: -1 };
        }
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalProducts = await Product.countDocuments(searchQuery);

    // Get products with pagination
    const products = await Product.find(searchQuery)
      .populate('category')
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum);

    // Get categories for filter
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });

    // Get unique brands for filter
    const brands = await Product.distinct('brand', { 
      isBlocked: false, 
      isDeleted: false 
    });

    // Get user's wishlist if logged in
    let wishlist = null;
    const userId = req.user?._id;
    if (userId) {
      wishlist = await Wishlist.findOne({ user: userId }).populate('products');
    }

    // Calculate pagination info
    const totalPages = Math.ceil(totalProducts / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    // Build pagination object
    const pagination = {
      currentPage: pageNum,
      totalPages,
      totalProducts,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? pageNum + 1 : null,
      prevPage: hasPrevPage ? pageNum - 1 : null,
      limit: limitNum
    };

    // Helper function to build pagination URLs
    const buildPaginationUrl = (page) => {
      const url = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
      url.searchParams.set('page', page);
      return url.toString();
    };

    res.render('user/search', {
      products,
      categories,
      brands,
      wishlist,
      query: query || '',
      sort,
      currentFilters: {
        brand,
        price_min,
        price_max,
        category: categorySlug
      },
      pagination,
      buildPaginationUrl,
      title: query ? `Search results for "${query}"` : 'Search Products',
      error: null
    });

  } catch (error) {
    console.error('Search error:', error);
    
    // Helper function for error case
    const buildPaginationUrl = (page) => {
      const url = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
      url.searchParams.set('page', page);
      return url.toString();
    };
    
    res.status(500).render('user/search', {
      products: [],
      categories: [],
      brands: [],
      wishlist: null,
      query: '',
      sort: 'relevance',
      currentFilters: {},
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalProducts: 0,
        hasNextPage: false,
        hasPrevPage: false,
        nextPage: null,
        prevPage: null,
        limit: 12
      },
      buildPaginationUrl,
      title: 'Search Products',
      error: 'An error occurred while searching. Please try again.'
    });
  }
};

// API endpoint for live search with sorting, filtering, and pagination
const searchAPI = async (req, res) => {
  try {
    const { 
      query, 
      page = 1, 
      sort = 'relevance', 
      brand, 
      price 
    } = req.query;

    if (!query || query.trim() === '') {
      return res.json({ products: [], total: 0, pagination: {} });
    }

    // Build search query
    let searchQuery = {
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { brand: { $regex: query, $options: 'i' } }
      ],
      isBlocked: false,
      isDeleted: false
    };

    // Add brand filter
    if (brand) {
      searchQuery.brand = { $regex: brand, $options: 'i' };
    }

    // Add price filter
    if (price) {
      const priceFilter = {};
      switch (price) {
        case 'below-50000':
          priceFilter.$lt = 50000;
          break;
        case '50000-100000':
          priceFilter.$gte = 50000;
          priceFilter.$lte = 100000;
          break;
        case 'above-100000':
          priceFilter.$gt = 100000;
          break;
      }
      if (Object.keys(priceFilter).length > 0) {
        searchQuery.salesPrice = priceFilter;
      }
    }

    // Build sort object
    let sortObj = {};
    switch (sort) {
      case 'price-asc':
        sortObj = { salesPrice: 1 };
        break;
      case 'price-desc':
        sortObj = { salesPrice: -1 };
        break;
      case 'name-asc':
        sortObj = { name: 1 };
        break;
      case 'name-desc':
        sortObj = { name: -1 };
        break;
      default: // relevance
        sortObj = { name: 1 };
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limit = 10;
    const skip = (pageNum - 1) * limit;

    // Get total count
    const total = await Product.countDocuments(searchQuery);

    // Get products with pagination
    const products = await Product.find(searchQuery)
      .populate('category')
      .select('name images salesPrice regularPrice brand category')
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    res.json({
      products,
      total,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limit),
        hasNextPage: pageNum < Math.ceil(total / limit),
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Search API error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
};

module.exports = {
  getSearchResults,
  searchAPI
};
