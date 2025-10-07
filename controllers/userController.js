const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const otpController = require('../controllers/otpController');
const bcrypt = require('bcryptjs');
const Wishlist = require('../models/Wishlist');
const {HTTP_STATUS}= require('../SM/status');
const { MESSAGE }= require('../SM/messages');

// Home Page
exports.loadHome = async (req, res) => {
  try {
    const products = await Product.find({ isBlocked: false });

    const loginSuccess = req.session.loginSuccess || false;
    req.session.loginSuccess = false;

    res.render('user/home', {
      products,
      user: req.session.user,
      loginSuccess    
    });

  } catch (error) {
    console.error("Home Load Error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(MESSAGE.INTERNAL_SERVER_ERROR);
  }
};

//Profile
exports.getProfile = async (req, res) => {
  try {
    const userId = req.session.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).send(MESSAGE.USER_NOT_FOUND);
    }

    const recentAddress = user.addresses && user.addresses.length > 0 
      ? user.addresses[user.addresses.length - 1] 
      : null;

    const recentOrder = await Order.findOne({ user: userId })
      .sort({ CdAt: -1 })
      .populate('products.product', 'name price');

    res.render('user/user-profile', {
      user,
      recentAddress,
      recentOrder,
    });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(MESSAGE.INTERNAL_SERVER_ERROR);
  }
};

//address
exports.getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).send(MESSAGE.USER_NOT_FOUND);
    }

    res.render('user/address', {
      addresses: user.addresses,
      alert: req.session.alert || null
    });

    req.session.alert = null; 
  } catch (err) {
    console.error('Error fetching user addresses:', err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(MESSAGE.INTERNAL_SERVER_ERROR);
  }
};

// Add New Address
exports.addAddress = async (req, res) => {
  try {
    const { name, street, city, state, zip, country, phone } = req.body;

    if (!name || !street || !city || !state || !zip || !country || !phone) {
      req.session.alert = {
        type: 'warning',
        message: 'All fields are required.'
      };
      return res.redirect('/user/address');
    }

    const user = await User.findById(req.session.user._id);
    if (!user) {
      req.session.alert = {
        type: 'error',
        message: MESSAGE.USER_NOT_FOUND
      };
      return res.redirect('/user/address');
    }

    const newAddress = {
      name,
      street,
      city,
      state,
      zip,
      country,
      phone,
      default: user.addresses.length === 0,
    };

    user.addresses.push(newAddress);
    await user.save();

    req.session.alert = {
      type: 'success',
      message: 'Address added successfully!'
    };

    res.redirect('/user/address');
  } catch (err) {
    console.error('Error adding address:', err);
    req.session.alert = {
      type: 'error',
      message: 'Failed to add address. Try again later.'
    };
    res.redirect('/user/address');
  }
};

// Get Edit Address Form
exports.getEditAddress = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).send(MESSAGE.USER_NOT_FOUND);
    }

    const addressId = req.params.addressId;
    const address = user.addresses.id(addressId);

    if (!address) {
      return res.status(HTTP_STATUS.NOT_FOUND).send('Address not found');
    }

    res.render('user/edit-address', { address });
  } catch (err) {
    console.error('Error fetching address for edit:', err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(MESSAGE.INTERNAL_SERVER_ERROR);
  }
};

// Update Address
exports.updateAddress = async (req, res) => {
  try {
    const { name, street, city, state, zip, country, phone } = req.body;
    const addressId = req.params.addressId;

    const user = await User.findById(req.session.user._id);
    if (!user) {
      req.session.alert = {
        type: 'error',
        message: 'User not found.'
      };
      return res.redirect('/user/address');
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      req.session.alert = {
        type: 'error',
        message: 'Address not found.'
      };
      return res.redirect('/user/address');
    }

    address.name = name;
    address.street = street;
    address.city = city;
    address.state = state;
    address.zip = zip;
    address.country = country;
    address.phone = phone;

    await user.save();

    req.session.alert = {
      type: 'success',
      message: 'Address updated successfully!'
    };

    res.redirect('/user/address');
  } catch (err) {
    console.error('Error updating address:', err);
    req.session.alert = {
      type: 'error',
      message: 'Failed to update address.'
    };
    res.redirect('/user/address');
  }
};

// Remove Address
exports.removeAddress = async (req, res) => {
  try {
    const addressId = req.params.addressId;
    const user = await User.findById(req.session.user._id);

    if (!user) {
      req.session.alert = {
        type: 'error',
        message: 'User not found.'
      };
      return res.redirect('/user/address');
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      req.session.alert = {
        type: 'error',
        message: 'Address not found.'
      };
      return res.redirect('/user/address');
    }

    user.addresses.pull(addressId);
    await user.save();

    req.session.alert = {
      type: 'success',
      message: 'Address removed successfully!'
    };

    res.redirect('/user/address');
  } catch (err) {
    console.error('Error removing address:', err);
    req.session.alert = {
      type: 'error',
      message: 'Failed to remove address.'
    };
    res.redirect('/user/address');
  }
};

// Get Products
exports.getProducts = async (req, res) => {
  try {
    const { search, category, sort, page = 1 } = req.query;
    const perPage = 12;
    const skip = (page - 1) * perPage;
    const query = { isBlocked: false };


    let sortOption = {};
    if (sort === 'price-asc') sortOption = { salesPrice: 1 };
    else if (sort === 'price-desc') sortOption = { salesPrice: -1 };

    let products = await Product.find(query)
      .populate('category')
      .populate('offers')
      .sort(sortOption)
      .skip(skip)
      .limit(perPage);

    products = await Promise.all(products.map(async (product) => {
      const offerDetails = await product.getBestOfferPrice();

      const pricing = {
        finalPrice: product.salesPrice || product.regularPrice,
        originalPrice: product.regularPrice,
        hasOffer: false,
        discountPercentage: 0
      };

      if (offerDetails?.hasOffer) {
        pricing.finalPrice = offerDetails.price;
        pricing.originalPrice = offerDetails.originalPrice;
        pricing.hasOffer = true;
        pricing.discountPercentage = Math.round(
          (offerDetails.originalPrice - offerDetails.price) / offerDetails.originalPrice * 100
        );
      } else if (product.salesPrice) {
        pricing.discountPercentage = Math.round(
          (product.regularPrice - product.salesPrice) / product.regularPrice * 100
        );
      }

      return {
        ...product.toObject(),
        pricing,
        stock: typeof product.stock === 'number' ? product.stock : 0 
      };
    }));

    if (sort === 'price-asc' || sort === 'price-desc') {
      products.sort((a, b) =>
        sort === 'price-asc'
          ? a.pricing.finalPrice - b.pricing.finalPrice
          : b.pricing.finalPrice - a.pricing.finalPrice
      );
    }

    let wishlist = [];
    const userId = req.user?._id;
    if (userId) {
      wishlist = await Wishlist.findOne({ user: userId }).populate('products');
    }
    /*console.log("this is wishlist",wishlist)*/

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);

    res.render('user/accessories', {
      products,
      wishlist,
      currentPage: parseInt(page),
      totalPages,
      search,
      category,
      sort,
      query: req.query
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Internal Server Error');
  }
};

// Get Product Details
exports.getProductDetails = async (req, res) => {
  try {
    const productId = req.params.productId;
    const product = await Product.findOne({
      _id: productId,
      isBlocked: false
    }).populate('category').populate('offers'); 

    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).send('Product not found or is unavailable');
    }

    const offerDetails = await product.getBestOfferPrice();
    
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId },
      isBlocked: false
    }).limit(4);

    res.render('user/product-details', { 
      user: req.session.user, 
      product,
      relatedProducts,
      offerDetails: offerDetails || { 
        hasOffer: false,
        price: product.salesPrice || product.regularPrice,
        originalPrice: product.regularPrice,
        discountPercentage: 0
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(MESSAGE.INTERNAL_SERVER_ERROR);
  }
};

// Retry Payment
exports.retryPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(HTTP_STATUS.BAD_REQUEST).send("Order ID missing");

    const order = await Order.findById(orderId);
    if (!order) return res.status(HTTP_STATUS.NOT_FOUND).send(MESSAGE.ORDER_NOT_FOUND);

    req.session.retryOrderId = order._id;
    req.session.checkout = {
      productIds: order.products.map(p => p.product),
      quantities: order.products.map(p => p.quantity),
      offerPrices: order.products.map(p => p.unitPrice)
    };

    return res.redirect('/user/checkout');
  } catch (err) {
    console.error("Retry Payment Error:", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(MESSAGE.SERVER_ERROR);
  }
};

exports.paymentFailed = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(HTTP_STATUS.NOT_FOUND).send(MESSAGE.ORDER_NOT_FOUND);

    order.status = "Pending";
    order.paymentStatus = "failed";
    await order.save();

    req.flash("error", "Payment failed. Please retry payment.");
    return res.redirect(`/order/${order._id}`); 
  } catch (err) {
    console.error("❌ Error marking order failed:", err.message);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(MESSAGE.INTERNAL_SERVER_ERROR);
  }
};

//forget password
exports.getForgotPasswordPage = (req, res) => {
  res.render('user/forgot-password', { error: null });
};


exports.handleForgotPassword = async (req, res) => {
  //console.log('POST /forgot-password route hit');
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.render('user/forgot-password', { error: 'Email not found. Please try again.' });
    }

    const otp = otpController.generateOtp(email);
    const isSent = await otpController.sendOtpEmail(email, otp);

    if (isSent) {
      return res.render('user/reotp', { email, error: null });
    } else {
      return res.render('user/forgot-password', { error: 'Failed to send OTP. Please try again later.' });
    }
  } catch (error) {
    console.error('Error during forgot-password handling:', error);
    return res.render('user/forgot-password', { error: 'An error occurred. Please try again later.' });
  }
};

// Verify OTP for Reset Password
exports.verifyOtpForReset = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const isValidOtp = otpController.verifyOtp(email, otp); // Replace with actual verification logic

    if (!isValidOtp) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: 'Invalid or expired OTP.' });
    }

    res.status(HTTP_STATUS.OK).json({ success: true, message: 'OTP verified successfully.' });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, error: 'An error occurred. Please try again.' });
  }
};

// Show Reset Password Page
exports.getResetPasswordPage = (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.redirect('/forgot-password'); // Redirect to forgot-password if email is missing
  }
  res.render('user/reset-password', { email, error: null });
};

// Handle Reset Password
exports.handleResetPassword = async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.render('user/reset-password', { email, error: 'Passwords do not match.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.render('user/reset-password', { email, error: MESSAGE.USER_NOT_FOUND });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    await user.save();
    res.redirect('/login');
  } catch (error) {
    console.error('Error during password reset:', error);
    res.render('user/reset-password', { email, error: 'An error occurred. Please try again.' });
  }
};
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      const error = 'Email and OTP are required.';
      return res.render('user/reotp', { error, email });
    }

    const isValid = await otpController.validateOtp(email, otp);

    if (isValid) {
      return res.render('user/reset-password', { email });
    } else {
      const error = 'Invalid OTP or OTP expired.';
      return res.render('user/reotp', { error, email });
    }
  } catch (error) {
    console.error('Error during OTP verification:', error);
    const errorMessage = 'An error occurred. Please try again.';
    return res.render('user/reotp', { error: errorMessage, email: req.body.email });
  }
};

// Resend OTP for Forgot Password
exports.resendOtp = async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.render('user/reotp', { email, message: 'Email is required.', messageType: 'error' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.render('user/reotp', { email, message: 'Email not found.', messageType: 'error' });
    }

    const otp = otpController.generateOtp(email);
    const isSent = await otpController.sendOtpEmail(email, otp);

    if (isSent) {
      return res.render('user/reotp', { email, message: 'OTP resent successfully!', messageType: 'success' });
    } else {
      return res.render('user/reotp', { email, message: 'Failed to send OTP. Please try again later.', messageType: 'error' });
    }
  } catch (error) {
    console.error('Error during OTP resend:', error);
    return res.render('user/reotp', { email, message: 'An error occurred. Please try again.', messageType: 'error' });
  }
};
exports.getProductDetailsWithRelated = async (req, res) => {
  try {
    const productId = req.params.productId;

    const product = await Product.findById(productId)
      .populate('category')
      .populate('offers');

    if (!product) {
     return res.send(`
  <html>
    <head>
      <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    </head>
    <body>
      <script>
        Swal.fire({
          icon: 'warning',
          title: 'Notice',
          text: "This product is currently blocked. Please go back.",
          confirmButtonText: 'Go Back',
          allowOutsideClick: false
        }).then(() => {
          window.location.href = "${req.get('referer') || '/'}";
        });
      </script>
    </body>
  </html>
`);

    }

    if (product.isBlocked) {
      return res.render('user/product-status', {
        message: 'This product is currently blocked. Please go back.',
        redirectUrl: req.get('referer') || '/'
      });
    }

    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId },
      isBlocked: false
    }).limit(4);

    res.render('user/Product-details', {
      user: req.session.user,
      product,
      relatedProducts
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Server Error');
  }
};

//wallet
exports.renderWalletPage = async (req, res) => {
  try {
    if (!req.session.user || !req.session.user._id) {
      return res.redirect('/login');
    }

    const user = await User.findById(req.session.user._id).lean();

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).send('User not found');
    }

    if (!user.wallet) {
      user.wallet = { balance: 0, transactions: [] };
    }


    const allTransactions = user.wallet.transactions.slice().reverse(); // Newest first
    const page = parseInt(req.query.page) || 1;
    const perPage = 5;
    const total = allTransactions.length;
    const totalPages = Math.ceil(total / perPage);
    const paginatedTransactions = allTransactions.slice((page - 1) * perPage, page * perPage);

    res.render('user/wallet', {
      user: {
        ...user,
        wallet: {
          balance: user.wallet.balance,
          transactions: paginatedTransactions,
        },
      },
      
      currentPage: page,
      totalPages
    });

  } catch (err) {
    console.error('Error loading wallet page:', err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Internal Server Error');
  }
};


exports.getWalletPage = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).lean(); // Use .lean() if using EJS

    if (!user.wallet) {
      user.wallet = { balance: 0, transactions: [] }; // fallback if missing
    }

    res.render('user/wallet', {
      user
    });
  } catch (err) {
    console.error('❌ Error loading wallet page:', err.message);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('user/error', { message: 'Unable to load wallet page' });
  }
};

//info
exports.getAboutUsPage = (req, res) => {
  res.render('user/aboutus');
};
exports.getServicesPage = (req, res) => {
  res.render('user/service');
};
exports.getSupportPage = (req, res) => {
  res.render('user/support');
};

exports.getContactPage = (req, res) => {
  res.render('user/contact');
};
exports.addToCartFromWishlist = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const productId = req.params.productId;

    const product = await Product.findOne({ _id: productId, isDeleted: false, isBlocked: false });

    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Product not found or unavailable' });
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const existingItem = cart.items.find(item => item.product.toString() === productId);

    if (existingItem) {
      if (existingItem.quantity >= 5) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Maximum quantity reached for this item' });
      }
      existingItem.quantity += 1;
    } else {
      cart.items.push({ product: productId, quantity: 1 });
    }

    await cart.save();

    await Wishlist.updateOne(
      { user: userId },
      { $pull: { products: productId } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Add to cart from wishlist error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to add item to cart' });
  }
};

