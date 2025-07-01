const Product = require('../models/Product');
const Category = require('../models/Category');
const User = require('../models/User');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
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
      .sort({ createdAt: -1 })
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
    const perPage = 12; // 12 products per page
    const query = { isBlocked: false }; // Only show non-blocked products

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (category) {
      query.category = category;
    }

    const sortOption = {};
    if (sort === 'price-asc') sortOption.salesPrice = 1;
    if (sort === 'price-desc') sortOption.salesPrice = -1;
    if (sort === 'name-asc') sortOption.name = 1;
    if (sort === 'name-desc') sortOption.name = -1;

    const skip = (page - 1) * perPage;

    const products = await Product.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(perPage);

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);

    res.render('user/home', {
      products,
      currentPage: parseInt(page),
      totalPages,
      search,
      category,
      sort,
      query: req.query // Pass all query parameters for pagination links
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
    }).populate('category');

    if (!product) {
      return res.status(404).send('Product not found or is unavailable');
    }

    // Add related products fetch
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId },
      isBlocked: false
    }).limit(4);

    res.render('user/product-details', { 
      user: req.session.user, 
      product,
      relatedProducts  // Make sure to pass this to the view
    });
  } catch (error) {
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
// Checkout
exports.checkout = async (req, res) => {
  try {
    const { productIds, quantities, productId, quantity, productUrl } = req.body;

    let cart = [];
    let totalAmount = 0;

    // Fetch user addresses
    const user = await User.findById(req.session.user._id);
    const addresses = user ? user.addresses || [] : [];

    if (productIds && quantities) {
      if (!Array.isArray(productIds) || !Array.isArray(quantities)) {
        return res.status(400).send('Invalid product or quantity format.');
      }

      const products = await Product.find({ _id: { $in: productIds } });
      if (products.length !== productIds.length) {
        return res.status(404).send('One or more products not found.');
      }

      cart = products.map((product, index) => {
        const itemQuantity = parseInt(quantities[index], 10);
        totalAmount += (product.salesPrice || product.regularPrice) * itemQuantity;
        return { product, quantity: itemQuantity };
      });
    } else if (productId && quantity) {
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).send('Product not found');
      }

      totalAmount = quantity * (product.salesPrice || product.regularPrice);
      cart = [{ product, quantity }];
    } else {
      return res.status(400).send('Invalid input. Provide productId and quantity or productIds and quantities.');
    }

    // Save cart and total to session
    req.session.cart = cart;
    req.session.totalAmount = totalAmount;

    // Render checkout page
    res.render('user/checkout', { cart, addresses, totalAmount, productUrl });
  } catch (err) {
    console.error('Checkout Route - Error:', err.message);
    res.status(500).send('Internal Server Error');
  }
};

exports.getCheckout = async (req, res) => {
  try {
    const cart = req.session.cart || [];
    const totalAmount = req.session.totalAmount || 0;

    const user = await User.findById(req.session.user._id);
    const addresses = user ? user.addresses || [] : [];

    res.render('user/checkout', { cart, addresses, totalAmount, productUrl: '' });
  } catch (err) {
    console.error('GET Checkout Route - Error:', err.message);
    res.status(500).send('Internal Server Error');
  }
};
// Place Order
exports.placeOrder = async (req, res) => {
  try {
    console.log('Place Order initiated with request body:', req.body);

    const { selectedAddress, productIds, quantities, paymentMethod } = req.body;

    if (!Array.isArray(productIds) || !Array.isArray(quantities)) {
      console.error('Invalid product or quantity format.');
      return res.status(400).send('Invalid product or quantity format.');
    }

    const user = await User.findById(req.session.user._id);
    if (!user) {
      console.error('User not found for ID:', req.session.user._id);
      return res.status(404).send('User not found');
    }

    console.log('User found:', user);

    const address = user.addresses.id(selectedAddress);
    if (!address) {
      console.error('Address not found for ID:', selectedAddress);
      return res.status(404).send('Address not found');
    }

    console.log('Selected address:', address);

    const products = await Product.find({ _id: { $in: productIds } });
    if (products.length !== productIds.length) {
      console.error('Mismatch in products retrieved. Expected:', productIds.length, 'Found:', products.length);
      return res.status(404).send('One or more products not found');
    }

    console.log('Products retrieved:', products);

    let totalAmount = 0;

    const orderItems = products.map((product, index) => {
      const quantity = parseInt(quantities[index], 10);
      const price = product.salesPrice || product.regularPrice;
      totalAmount += price * quantity;

      console.log(`Product: ${product.name}, Quantity: ${quantity}, Price: ${price}, Total Amount: ${totalAmount}`);
      return {
        product,
        quantity,
      };
    });

    let deliveryCharge = 0;
    if (totalAmount < 50000) {
      deliveryCharge = 80; // Flat delivery charge for orders under ₹50,000
    }

    totalAmount += deliveryCharge;

    console.log('Delivery charge:', deliveryCharge, 'Final Total Amount:', totalAmount);

    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + 6);

    req.session.orderItems = orderItems;
    req.session.address = address;
    req.session.paymentMethod = paymentMethod;
    req.session.totalAmount = totalAmount;
    req.session.deliveryCharge = deliveryCharge;
    req.session.arrivalDate = estimatedDate;

    console.log('Order session details set:', req.session);

    res.render('user/order-confirmation', {
      orderItems,
      address,
      paymentMethod,
      totalAmount,
      deliveryCharge,
      estimatedDate,
      checkoutUrl: '/user/checkout',
    });
  } catch (err) {
    console.error('Error during order confirmation:', err.message);
    res.status(500).send(err.message || 'Internal Server Error');
  }
};

// Confirm Payment
exports.confirmPayment = async (req, res) => {
  try {
    console.log('Confirm Payment initiated with request body:', req.body);

    const { productIds, quantities, selectedAddress, paymentMethod } = req.body;

    if (!Array.isArray(productIds) || !Array.isArray(quantities)) {
      console.error('Invalid product or quantity format.');
      return res.status(400).send('Invalid product or quantity format.');
    }

    const user = await User.findById(req.session.user._id);
    if (!user) {
      console.error('User not found for ID:', req.session.user._id);
      return res.status(404).send('User not found');
    }

    console.log('User found:', user);

    const address = user.addresses.id(selectedAddress);
    if (!address) {
      console.error('Address not found for ID:', selectedAddress);
      return res.status(404).send('Address not found');
    }

    console.log('Selected address:', address);

    const products = await Product.find({ _id: { $in: productIds } });
    if (products.length !== productIds.length) {
      console.error('Mismatch in products retrieved. Expected:', productIds.length, 'Found:', products.length);
      return res.status(404).send('One or more products not found');
    }

    console.log('Products retrieved:', products);

    let totalAmount = 0;
    const orderItems = [];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const quantity = parseInt(quantities[i], 10);

      if (quantity > product.quantity) {
        console.error('Insufficient stock for product:', product.name);
        throw new Error(`Insufficient stock for product: ${product.name}`);
      }

      const price = product.salesPrice || product.regularPrice;
      totalAmount += price * quantity;

      console.log(`Product: ${product.name}, Quantity: ${quantity}, Price: ${price}, Total Amount: ${totalAmount}`);

      orderItems.push({
        product: {
          _id: product._id,
          name: product.name,
          brand: product.brand,
          salesPrice: product.salesPrice,
          regularPrice: product.regularPrice,
          images: product.images,
        },
        quantity,
      });

      product.quantity -= quantity;
      await product.save();
      console.log(`Updated stock for product: ${product.name}, Remaining Stock: ${product.quantity}`);
    }

    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + 6);

    let deliveryCharge = 0;
    if (totalAmount < 50000) {
      deliveryCharge = 80; // Flat delivery charge for orders under ₹50,000
    }

    totalAmount += deliveryCharge;
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
      status: 'Pending',
    });

    await newOrder.save();
    console.log('Order successfully saved:', newOrder);

    req.session.orderItems = orderItems;
    req.session.address = address;
    req.session.paymentMethod = paymentMethod;
    req.session.totalAmount = totalAmount;
    req.session.arrivalDate = estimatedDate;

    res.redirect('/user/confirm-payment');
  } catch (err) {
    console.error('Error during payment confirmation:', err.message);
    res.status(500).send(err.message || 'Internal Server Error');
  }
};

// Render Confirm Payment Page (GET request)
exports.renderConfirmPayment = async (req, res) => {
  try {
    console.log('Rendering confirm payment page with session data:', req.session);

    const { orderItems, address, paymentMethod, totalAmount, deliveryCharge, arrivalDate } = req.session;

    if (!orderItems || !address || !paymentMethod || !totalAmount || !arrivalDate) {
      console.error('Missing order details in session.');
      return res.status(400).send('Missing order details.');
    }

    // Calculate the final amount including delivery charge
    const finalTotalAmount = totalAmount + deliveryCharge;

    // === Related Products Logic ===
    let relatedProducts = [];
    if (orderItems.length > 0) {
      const categories = orderItems.map(item => item.product.category);
      // Fetch related products from same categories
      relatedProducts = await Product.find({
        category: { $in: categories },
        _id: { $nin: orderItems.map(item => item.product._id) }, // exclude already ordered items
      }).limit(6);
    }

    res.render('user/confirm-payment', {
      orderItems,
      address,
      paymentMethod,
      totalAmount: finalTotalAmount, // Updated amount
      deliveryCharge,
      arrivalDate: new Date(arrivalDate), // Ensure proper date format
      relatedProducts // ✅ Passed to EJS
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
    }).populate('category');

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