const Product = require('../models/Product');
const Category = require('../models/Category');
const User = require('../models/User');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Coupon = require('../models/Coupon')
const mongoose = require('mongoose');
const otpController = require('../controllers/otpController');
const bcrypt = require('bcryptjs');
//Profile
exports.getProfile = async (req, res) => {
  try {
    const userId = req.session.user._id;

    // Fetch user, recent address, and recent order
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send('User not found');
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
    res.status(500).send('Internal Server Error');
  }
};

//address
exports.getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    if (!user) {
      return res.status(404).send('User not found');
    }

    res.render('user/address', {
      addresses: user.addresses,  // Pass the addresses to the view
    });
  } catch (err) {
    console.error('Error fetching user addresses:', err);
    res.status(500).send('Internal Server Error');
  }
};
exports.addAddress = async (req, res) => {
  try {
    const { name, street, city, state, zip, country, phone } = req.body;

    // Validate input
    if (!name || !street || !city || !state || !zip || !country || !phone) {
      return res.status(400).send('All fields are required');
    }

    // Find user
    const user = await User.findById(req.session.user._id);
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Add the new address
    const newAddress = {
      name,
      street,
      city,
      state,
      zip,
      country,
      phone,
      default: user.addresses.length === 0, // First address is default
    };

    user.addresses.push(newAddress);
    await user.save();

    // Redirect back to the addresses page
    res.redirect('/user/address');
  } catch (err) {
    console.error('Error adding address:', err);
    res.status(500).send('Internal Server Error');
  }
};

// Get Edit Address Form
exports.getEditAddress = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Find the address to edit based on the addressId parameter
    const addressId = req.params.addressId;
    const address = user.addresses.id(addressId);

    if (!address) {
      return res.status(404).send('Address not found');
    }

    // Render the edit address page with the address data
    res.render('user/edit-address', {
      address,
    });
  } catch (err) {
    console.error('Error fetching address for edit:', err);
    res.status(500).send('Internal Server Error');
  }
};

// Update Address
exports.updateAddress = async (req, res) => {
  try {
    const { name, street, city, state, zip, country, phone, default: isDefault } = req.body;
    const addressId = req.params.addressId;

    const user = await User.findById(req.session.user._id);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const address = user.addresses.id(addressId);

    if (!address) {
      return res.status(404).send('Address not found');
    }

    // Update the address fields
    address.name = name;
    address.street = street;
    address.city = city;
    address.state = state;
    address.zip = zip;
    address.country = country;
    address.phone = phone;
    address.default = isDefault || false; // Ensure default field is set correctly

    // Save the updated user data
    await user.save();

    // Redirect back to the address page with success message
    res.redirect('/user/address');
  } catch (err) {
    console.error('Error updating address:', err);
    res.status(500).send('Internal Server Error');
  }
};
exports.removeAddress = async (req, res) => {
  try {
    const addressId = req.params.addressId;
    const user = await User.findById(req.session.user._id);
    
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Find and remove the address from the user's address array
    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).send('Address not found');
    }

    // Remove the address from the addresses array
    user.addresses.pull(addressId);

    // Save the updated user data
    await user.save();

    // Redirect to the address page after removing the address
    res.redirect('/user/address');
  } catch (err) {
    console.error('Error removing address:', err);
    res.status(500).send('Internal Server Error');
  }
};
exports.viewOrders = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { sortBy = 'newest', page = 1 } = req.query; // Default to 'newest' and 'page 1'

    // Set sorting criteria
    const sortCriteria = sortBy === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };

    // Number of orders per page
    const ordersPerPage = 5;

    // Calculate skip based on the page number
    const skip = (page - 1) * ordersPerPage;

    // Fetch orders with pagination
    const orders = await Order.find({ user: userId })
      .sort(sortCriteria)
      .skip(skip) // Skip the appropriate number of orders for pagination
      .limit(ordersPerPage) // Limit the number of orders per page
      .populate('products.product', 'name');

    // Count total number of orders to calculate total pages
    const totalOrders = await Order.countDocuments({ user: userId });
    const totalPages = Math.ceil(totalOrders / ordersPerPage); // Calculate total pages

    // Render the view, passing orders, sortBy, and pagination data
    res.render('user/userOrder', { 
      orders, 
      sortBy, 
      currentPage: page, 
      totalPages 
    });

  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).send('Server error');
  }
};


// Get order details by ID
exports.viewOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId)
      .populate('products.product')  // Populate products
      .populate('user')  // Populate the user (to get the addresses)
      .exec();  // Ensure execution of the query

    if (!order) {
      return res.status(404).send('Order not found');
    }

    // Get the selected address from the user's addresses array
    const selectedAddress = order.user.addresses.find(
      (address) => address._id.toString() === order.selectedAddress.toString()
    );

    if (!selectedAddress) {
      return res.status(404).send('Selected address not found');
    }

    console.log('Order Details:', order);

    res.render('user/orderDetails', { order, selectedAddress });
  } catch (err) {
    console.error('Error fetching order details:', err);
    res.status(500).send('Server error');
  }
};
exports.cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).send('Order not found');
    }

    // Check if the order is still in a 'Pending' status
    if (order.status !== 'Pending') {
      return res.status(400).send('Order cannot be canceled');
    }

    // Update order status to 'User Cancelled'
    order.status = 'User Cancelled';
    await order.save();

    res.redirect('/user/orders'); // Redirect to the orders page after cancellation
  } catch (err) {
    console.error('Error canceling order:', err);
    res.status(500).send('Server error');
  }
};
// Get Products
exports.getProducts = async (req, res) => {
  try {
    const { search, category, sort, page = 1 } = req.query;
    const perPage = 12;
    const query = { isBlocked: false };

    // ... (your existing query logic)

    let products = await Product.find(query)
      .populate('category')
      .populate('offers')
      .sort(sortOption)
      .skip(skip)
      .limit(perPage);

    // Ensure every product has pricing information
    products = await Promise.all(products.map(async (product) => {
      const offerDetails = await product.getBestOfferPrice();
      
      // Default pricing structure
      const pricing = {
        finalPrice: product.salesPrice || product.regularPrice,
        originalPrice: product.regularPrice,
        hasOffer: false,
        discountPercentage: 0
      };

      // If there's an offer, update pricing
      if (offerDetails && offerDetails.hasOffer) {
        pricing.finalPrice = offerDetails.price;
        pricing.hasOffer = true;
        pricing.discountPercentage = Math.round(
          (offerDetails.originalPrice - offerDetails.price) / 
          offerDetails.originalPrice * 100
        );
      } 
      // If no offer but sales price exists
      else if (product.salesPrice) {
        pricing.finalPrice = product.salesPrice;
        pricing.discountPercentage = Math.round(
          (product.regularPrice - product.salesPrice) / 
          product.regularPrice * 100
        );
      }

      return {
        ...product.toObject(),
        pricing // Ensure pricing object always exists
      };
    }));

    // Re-sort if sorting by price (since we need to consider offer prices)
    if (sort === 'price-asc' || sort === 'price-desc') {
      products.sort((a, b) => {
        return sort === 'price-asc' 
          ? a.pricing.finalPrice - b.pricing.finalPrice 
          : b.pricing.finalPrice - a.pricing.finalPrice;
      });
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);

      res.render('user/accessories', {
      products,
      currentPage: parseInt(page),
      totalPages,
      search,
      category,
      sort,
      query: req.query
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).send('Internal Server Error');
  }
};

// Get Product Details
exports.getProductDetails = async (req, res) => {
  try {
    const productId = req.params.productId;
    const product = await Product.findOne({
      _id: productId,
      isBlocked: false
    }).populate('category').populate('offers'); // Add populate('offers')

    if (!product) {
      return res.status(404).send('Product not found or is unavailable');
    }

    // Calculate offer details
    const offerDetails = await product.getBestOfferPrice();
    
    // Add related products fetch
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId },
      isBlocked: false
    }).limit(4);

    res.render('user/product-details', { 
      user: req.session.user, 
      product,
      relatedProducts,
      offerDetails: offerDetails || { // Provide default values
        hasOffer: false,
        price: product.salesPrice || product.regularPrice,
        originalPrice: product.regularPrice,
        discountPercentage: 0
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
};
/* In userController.js
exports.searchProducts = async (req, res) => {
  try {
    const query = req.query.query;
    const products = await Product.find({
      $text: { $search: query },
      isBlocked: false,
      isDeleted: false
    }).limit(10);

    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
};*/
// Combined checkout method
exports.checkout = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    const { productIds, quantities, productId, quantity, productUrl } = req.body;
    const user = await User.findById(req.session.user._id);
    let cart = [];
    let totalAmount = 0;
    let offerPrices = [];

    // 🔥 Fetch active coupons
  const now = new Date();
const coupons = await Coupon.find({
  isActive: true,
  startDate: { $lte: now },
  endDate: { $gte: now }
}).sort({ createdAt: -1 });

    //multi items handle
  if (productIds && quantities && Array.isArray(productIds) && Array.isArray(quantities)) {
  for (let i = 0; i < productIds.length; i++) {
    const product = await Product.findById(productIds[i]);
    if (product) {
      const qty = parseInt(quantities[i]);
      const offerDetails = await product.getBestOfferPrice();
      const price = offerDetails.price;

      offerPrices.push(price); // 👈 Correct

      cart.push({
        product: {
          _id: product._id,
          name: product.name,
          salesPrice: product.salesPrice,
          regularPrice: product.regularPrice,
          images: product.images,
          offerDetails
        },
        quantity: qty
      });

      totalAmount += qty * price;
    }
  }

  // 💾 Save to session
  req.session.checkout = {
    productIds,
    quantities,
    offerPrices,
    totalAmount,
    isFromCart: true
  };
} else if (productId && quantity) {
  const product = await Product.findById(productId);
  if (!product) return res.status(404).send('Product not found');

  const offerDetails = await product.getBestOfferPrice();
  const price = offerDetails.price;
  const qty = parseInt(quantity);

  cart = [{
    product: {
      _id: product._id,
      name: product.name,
      salesPrice: product.salesPrice,
      regularPrice: product.regularPrice,
      images: product.images,
      offerDetails
    },
    quantity: qty
  }];

  totalAmount = qty * price;

  req.session.checkout = {
    productIds: [productId],
    quantities: [quantity],
    offerPrices: [price],
    totalAmount,
    isFromCart: false
  };
} else {
  return res.redirect('/cart');
}


    // ✅ Render checkout with accurate total
    res.render('user/checkout', {
      user: req.session.user,
      cart,
      addresses: user.addresses || [],
      totalAmount,
      session: req.session,
      productUrl: productUrl || '',
      coupons,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID 
    });
  } catch (err) {
    console.error('Checkout Error:', err);
    res.status(500).send('Internal Server Error');
  }
};


exports.getCheckout = async (req, res) => {
  try {
    const user = req.session.user;
    const addresses = await Address.find({ user: user._id });
    const cart = await getUserCart(user._id);
    const totalAmount = calculateTotal(cart);

const now = new Date();
const coupons = await Coupon.find({
  isActive: true,
  startDate: { $lte: now },
  endDate: { $gte: now }
}).sort({ createdAt: -1 });


    res.render('user/checkout', {
      user,
      addresses,
      cart,
      totalAmount,
      session: req.session,
      coupons // ✅ Pass coupons here
    });
  } catch (error) {
    console.error('Checkout page error:', error);
    res.status(500).render('user/error', { message: 'Failed to load checkout' });
  }
};
function calculateDiscountAmount(products, quantities, offerPrices = []) {
  let totalDiscount = 0;

  products.forEach((product, index) => {
    const quantity = parseInt(quantities[index]);
    const regular = product.regularPrice;
    const price = offerPrices[index] || product.salesPrice || regular;

    if (regular > price) {
      totalDiscount += (regular - price) * quantity;
    }
  });

  return totalDiscount;
}



// Place Order
exports.placeOrder = async (req, res) => {
  try {
    const { selectedAddress, paymentMethod } = req.body;

    const checkoutData = req.session.checkout;
    if (
      !checkoutData ||
      !Array.isArray(checkoutData.productIds) ||
      !Array.isArray(checkoutData.quantities)
    ) {
      return res.status(400).send('Checkout session missing or invalid.');
    }

    const { productIds, quantities, offerPrices } = checkoutData;

    const user = await User.findById(req.session.user._id);
    if (!user) return res.status(404).send('User not found');

    const address = user.addresses.id(selectedAddress);
    if (!address) return res.status(404).send('Address not found');

    const products = await Product.find({ _id: { $in: productIds } });
    if (products.length !== productIds.length) {
      return res.status(404).send('One or more products not found');
    }

    let totalAmount = 0;
    const orderItems = [];

    for (let i = 0; i < products.length; i++) {
      const quantity = parseInt(quantities[i], 10);
      const price = parseFloat(offerPrices[i]);

      if (isNaN(quantity) || isNaN(price)) {
        return res.status(400).send('Invalid quantity or price');
      }

      totalAmount += price * quantity;

      orderItems.push({
        product: products[i],
        quantity,
        offerPrice: price
      });
    }

    const discountAmount = calculateDiscountAmount(products, quantities, offerPrices);
    let deliveryCharge = totalAmount < 50000 ? 80 : 0;
    totalAmount += deliveryCharge;

    let couponDiscount = 0;
    if (req.session.coupon?.discountAmount) {
      const discount = parseFloat(req.session.coupon.discountAmount);
      if (!isNaN(discount) && discount > 0 && discount <= totalAmount) {
        couponDiscount = discount;
        totalAmount -= discount;
      }
    }

    // 🔒 COD Limit Check
    if (paymentMethod === 'COD' && totalAmount > 20000) {
      return res.status(400).send(
        'Cash on Delivery is only available for orders up to ₹20,000. Please choose Online Payment.'
      );
    }

    // 🔒 Razorpay Limit Check
    if (paymentMethod === 'Online' && totalAmount > 450000) {
      return res.status(400).send(
        'Online payments above ₹4.5 Lakhs are not supported. Please reduce your cart total.'
      );
    }

    if (totalAmount <= 0) {
      return res.status(400).send('Invalid total amount.');
    }

    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + 6);

    const createdOrder = await Order.create({
      user: user._id,
      selectedAddress: address._id,
      products: orderItems.map(item => ({
        product: item.product._id,
        quantity: item.quantity
      })),
      totalAmount,
      paymentMethod,
      deliveryCharge,
      estimatedDelivery: estimatedDate,
      status: paymentMethod === 'COD' ? 'Placed' : 'Pending',
      discountAmount,
      couponDiscount
    });

    req.session.orderItems = orderItems;
    req.session.address = address;
    req.session.paymentMethod = paymentMethod;
    req.session.totalAmount = totalAmount;
    req.session.deliveryCharge = deliveryCharge;
    req.session.arrivalDate = estimatedDate;
    req.session.couponDiscount = couponDiscount;
    req.session.orderId = createdOrder._id;

    res.render('user/order-confirmation', {
      orderItems,
      address,
      paymentMethod,
      totalAmount,
      deliveryCharge,
      estimatedDate,
      orderId: createdOrder._id,
      paymentVerified: false,
      paymentDetails: null,
      checkoutUrl: '/user/checkout',
      couponDiscount
    });

  } catch (err) {
    console.error('❌ Error placing order:', err.message);
    res.status(500).send(err.message || 'Internal Server Error');
  }
};

// Confirm Payment
exports.confirmPayment = async (req, res) => {
  try {
    const checkoutData = req.session.checkout;
    const { selectedAddress, paymentMethod } = req.body;

    if (
      !checkoutData ||
      !Array.isArray(checkoutData.productIds) ||
      !Array.isArray(checkoutData.quantities)
    ) {
      return res.status(400).send('Checkout session missing or invalid.');
    }

    const { productIds, quantities, offerPrices } = checkoutData;

    const user = await User.findById(req.session.user._id);
    if (!user) return res.status(404).send('User not found');

    const address = user.addresses.id(selectedAddress);
    if (!address) return res.status(404).send('Address not found');

    const products = await Product.find({ _id: { $in: productIds } });
    if (products.length !== productIds.length) {
      return res.status(404).send('One or more products not found');
    }

    let totalAmount = 0;
    const orderItems = [];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const quantity = parseInt(quantities[i], 10);

      if (quantity > product.quantity) {
        throw new Error(`Insufficient stock for product: ${product.name}`);
      }

      const price = offerPrices ? parseFloat(offerPrices[i]) : (product.salesPrice || product.regularPrice);
      totalAmount += price * quantity;

      orderItems.push({
        product: {
          _id: product._id,
          name: product.name,
          brand: product.brand,
          images: product.images,
        },
        quantity,
        offerPrice: price
      });

      product.quantity -= quantity;
      await product.save();
    }

    const discountAmount = calculateDiscountAmount(products, quantities, offerPrices);
    let deliveryCharge = totalAmount < 50000 ? 80 : 0;
    totalAmount += deliveryCharge;

    let couponDiscount = 0;
    if (req.session.coupon?.discountAmount) {
      couponDiscount = req.session.coupon.discountAmount;
      totalAmount -= couponDiscount;
    }

    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + 6);

    const newOrder = new Order({
      user: user._id,
      products: orderItems.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
      })),
      totalAmount,
      selectedAddress: address._id,
      paymentMethod,
      estimatedDelivery: estimatedDate,
      deliveryCharge,
      status: 'Pending',
      discountAmount,
      couponDiscount
    });

    await newOrder.save();

    req.session.orderItems = orderItems;
    req.session.address = address;
    req.session.paymentMethod = paymentMethod;
    req.session.totalAmount = totalAmount;
    req.session.deliveryCharge = deliveryCharge;
    req.session.arrivalDate = estimatedDate;
    req.session.couponDiscount = couponDiscount;

    res.redirect('/user/confirm-payment');
  } catch (err) {
    console.error('Error during payment confirmation:', err.message);
    res.status(500).send(err.message || 'Internal Server Error');
  }
};


// Render Confirm Payment Page (GET request)
exports.renderConfirmPayment = async (req, res) => {
  try {
    const {
      orderItems,
      address,
      paymentMethod,
      totalAmount,
      deliveryCharge,
      arrivalDate,
      couponDiscount
    } = req.session;

    if (!orderItems || !address || !paymentMethod || !totalAmount || !arrivalDate) {
      return res.status(400).send('Missing order details.');
    }

    const finalTotalAmount = totalAmount;

    // Related products
    let relatedProducts = [];
    if (orderItems.length > 0) {
      const categories = orderItems.map(item => item.product.category);
      relatedProducts = await Product.find({
        category: { $in: categories },
        _id: { $nin: orderItems.map(item => item.product._id) },
      }).limit(6);
    }

    res.render('user/confirm-payment', {
      orderItems,
      address,
      paymentMethod,
      totalAmount: finalTotalAmount,
      deliveryCharge,
      arrivalDate: new Date(arrivalDate),
      relatedProducts,
      couponDiscount // ✅ Pass to EJS
    });
  } catch (err) {
    console.error('Error rendering confirmation page:', err.message);
    res.status(500).send(err.message || 'Internal Server Error');
  }
};


//settings
exports.getSettingsPage = (req, res) => {
  console.log("Navigating to settings page.");
  res.render('user/settings', { user: req.session.user });
};


// Change Password Logic
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    const user = await User.findById(req.session.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Password updated successfully!" });
  } catch (error) {
    console.error("Error in changing password:", error);
    res.status(500).json({ message: "An error occurred." });
  }
};

// Update name
exports.updateUserName = async (req, res) => {
  const userId = req.session.user?._id; // Assuming you're storing the full user object in the session
  const { name } = req.body;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized. Please log in.' });
  }

  if (!name || name.trim() === '') {
    return res.status(400).json({ message: 'Name cannot be empty.' });
  }

  try {
    // Find the user and update the name, but don't modify the email
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name: name.trim() }, // Only update the name, not the email
      { new: true, runValidators: true } // Return the updated document
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Respond with success or redirect as needed
    res.redirect('/user/profile'); // Redirect back to the profile page
  } catch (error) {
    console.error('Error updating user name:', error);
    res.status(500).json({ message: 'An error occurred while updating the name.' });
  }
};
// Show Forgot Password Page
exports.getForgotPasswordPage = (req, res) => {
  res.render('user/forgot-password', { error: null });
};

// Handle Forgot Password (Verify Email and Send OTP)
exports.handleForgotPassword = async (req, res) => {
  console.log('POST /forgot-password route hit');
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
      return res.status(400).json({ success: false, error: 'Invalid or expired OTP.' });
    }

    res.status(200).json({ success: true, message: 'OTP verified successfully.' });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
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

// Handle Reset Password (Save New Password)
exports.handleResetPassword = async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.render('user/reset-password', { email, error: 'Passwords do not match.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.render('user/reset-password', { email, error: 'User not found.' });
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
    const productId = req.params.productId; // Make sure this matches your route parameter
    const product = await Product.findOne({
      _id: productId,
      isBlocked: false
    }).populate('category')
    .populate('offers');

    if (!product) {
      return res.status(404).send('Product not found');
    }

    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId },//
      isBlocked: false
    }).limit(4);
    console.log("related:",relatedProducts)

    res.render('user/Product-details', { 
      user: req.session.user, 
      product,
      relatedProducts 
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Server Error');
  }
};
exports.cancelEntireOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(id).populate('products.product');

    if (!order) return res.status(404).send('Order not found');

    if (!['Pending', 'Placed'].includes(order.status)) {
      return res.status(400).send('Cannot cancel this order.');
    }

    // Restock products
    for (let item of order.products) {
      const product = item.product;
      product.quantity += item.quantity;
      await product.save();
    }

    order.status = 'User Cancelled';
    order.cancellationReason = reason || '';
    await order.save();

    res.redirect('/user/orders');
  } catch (err) {
    console.error('Cancel entire order error:', err);
    res.status(500).send('Server error');
  }
};
exports.returnProduct = async (req, res) => {
  try {
    const { orderId, productId } = req.params;
    const { reason, quantity } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).send('Return reason is required');
    }

    const order = await Order.findById(orderId);

    if (!order || order.status !== 'Delivered') {
      return res.status(400).send('Only delivered orders can be returned');
    }

    const productEntry = order.products.find(
      item => item.product.toString() === productId
    );

    if (!productEntry) {
      return res.status(404).send('Product not found in order');
    }

    order.returnedItems.push({
      product: productEntry.product,
      quantity: quantity || productEntry.quantity,
      reason: reason,
    });

    order.returnRequested = true;
    order.returnStatus = 'Requested';
    await order.save();

    res.redirect('/user/orders');
  } catch (err) {
    console.error('Return product error:', err);
    res.status(500).send('Server error');
  }
};
exports.returnOrder = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    const orderId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).send('Invalid Order ID');
    }

    const order = await Order.findById(orderId);

    if (!order || order.user.toString() !== req.session.user._id.toString()) {
      return res.status(404).send('Order not found');
    }

    if (order.status !== 'Delivered') {
      return res.status(400).send('Only delivered orders can be returned');
    }

    order.status = 'Return Requested';
    await order.save();

    res.redirect('/user/orders');
  } catch (err) {
    console.error('Error returning order:', err);
    res.status(500).send('Internal Server Error');
  }
};

//wallet
exports.renderWalletPage = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);

    if (!user) {
      return res.status(404).send('User not found');
    }

    res.render('user/wallet', { user });
  } catch (err) {
    console.error('Error loading wallet page:', err);
    res.status(500).send('Internal Server Error');
  }
};