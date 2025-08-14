const Product = require('../models/Product');
const Category = require('../models/Category');
const User = require('../models/User');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Coupon = require('../models/Coupon')
const mongoose = require('mongoose');
const otpController = require('../controllers/otpController');
const bcrypt = require('bcryptjs');
const Wishlist = require('../models/Wishlist');
const PDFDocument = require('pdfkit');

exports.loadHome = async (req, res) => {
  try {
    const products = await Product.find({ isBlocked: false });

    const loginSuccess = req.session.loginSuccess || false;
    req.session.loginSuccess = false;

    res.render('user/home', {
      products,
      user: req.session.user,
      loginSuccess    // ✅ pass to EJS
    });

  } catch (error) {
    console.error("Home Load Error:", error);
    res.status(500).send("Internal Server Error");
  }
};



//Profile
exports.getProfile = async (req, res) => {
  try {
    const userId = req.session.user._id;

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
      addresses: user.addresses,
      alert: req.session.alert || null
    });

    req.session.alert = null; 
  } catch (err) {
    console.error('Error fetching user addresses:', err);
    res.status(500).send('Internal Server Error');
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
        message: 'User not found.'
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
      return res.status(404).send('User not found');
    }

    const addressId = req.params.addressId;
    const address = user.addresses.id(addressId);

    if (!address) {
      return res.status(404).send('Address not found');
    }

    res.render('user/edit-address', { address });
  } catch (err) {
    console.error('Error fetching address for edit:', err);
    res.status(500).send('Internal Server Error');
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

exports.removeAddress = async (req, res) => {
  try {
    const addressId = req.params.addressId;
    const user = await User.findById(req.session.user._id);
    
    if (!user) {
      return res.status(404).send('User not found');
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).send('Address not found');
    }

    user.addresses.pull(addressId);

    await user.save();

    res.redirect('/user/address');
  } catch (err) {
    console.error('Error removing address:', err);
    res.status(500).send('Internal Server Error');
  }
};
//Order
exports.viewOrders = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { sortBy = 'newest', page = 1 } = req.query; //page

    //sort
    const sortCriteria = sortBy === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };

    //no:of items in one page
    const ordersPerPage = 5;

    const skip = (page - 1) * ordersPerPage;

    const orders = await Order.find({ user: userId })
      .sort(sortCriteria)
      .skip(skip) 
      .limit(ordersPerPage)
      .populate('products.product', 'name');

    const totalOrders = await Order.countDocuments({ user: userId });
    const totalPages = Math.ceil(totalOrders / ordersPerPage); 

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

    let query = Order.findById(orderId)
      .populate('products.product')
      .populate('user');

    const orderDoc = await Order.findById(orderId).select('coupon');
    if (orderDoc && orderDoc.coupon && mongoose.Types.ObjectId.isValid(orderDoc.coupon)) {
      query = query.populate('coupon');
    }

    const order = await query.exec();

    if (!order) {
      return res.status(404).send('Order not found');
    }

    const selectedAddress = order.user.addresses.find(
      (address) =>
        order.selectedAddress &&
        address._id.toString() === order.selectedAddress.toString()
    );

    if (!selectedAddress) {
      return res.status(404).send('Selected address not found');
    }

    res.render('user/orderDetails', {
      order,
      selectedAddress,
    });

  } catch (err) {
    console.error('Error fetching order details:', err.stack || err);
    res.status(500).send('Server error');
  }
};

//Bill
exports.downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).send('Invalid order ID');
    }

    const order = await Order.findById(orderId)
      .populate('products.product')
      .populate('coupon')
      .populate('user');

    if (!order) {
      return res.status(404).send('Order not found');
    }

    const selectedAddress = order.user.addresses.find(
      (addr) => addr._id.toString() === order.selectedAddress.toString()
    );

    if (!selectedAddress) {
      return res.status(404).send('Address not found');
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${order.orderId}.pdf`
    );

    doc.pipe(res);

    doc.fontSize(20).text('INVOICE', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Order ID: ${order.orderId}`);
    doc.text(`Order Date: ${new Date(order.createdAt).toLocaleDateString()}`);
    doc.text(`Payment Method: ${order.paymentMethod}`);
    doc.text(`Status: ${order.status}`);
    doc.moveDown();

    doc.fontSize(14).text('Shipping Address', { underline: true });
    doc.text(`${selectedAddress.name}`);
    doc.text(`${selectedAddress.street}`);
    doc.text(`${selectedAddress.city}, ${selectedAddress.state} - ${selectedAddress.zip}`);
    doc.text(`${selectedAddress.country}`);
    doc.text(`Phone: ${selectedAddress.phone}`);
    doc.moveDown();

    doc.fontSize(14).text('Product Details', { underline: true });

    let subtotal = 0;

    order.products.forEach((item, index) => {
      const price = item.product.salesPrice || item.product.regularPrice || 0;
      const total = price * item.quantity;
      subtotal += total;

      doc.text(
        `${index + 1}. ${item.product.name} - ₹${price} x ${item.quantity} = ₹${total.toFixed(2)}`
      );
    });

    doc.moveDown();
    doc.fontSize(12).text(`Subtotal: ₹${subtotal.toFixed(2)}`);

    if (order.deliveryCharge && order.deliveryCharge > 0) {
      doc.text(`Delivery Charge: ₹${order.deliveryCharge.toFixed(2)}`);
    }

    if (order.coupon) {
      doc.moveDown();
      doc.fontSize(14).text('Coupon Details', { underline: true });
      doc.fontSize(12).text(`Code: ${order.coupon.code}`);
      doc.text(`Type: ${order.coupon.discountType === 'percentage' ? 'Percentage' : 'Fixed Amount'}`);
      doc.text(`Discount: ${order.coupon.discountType === 'percentage'
        ? `${order.coupon.discount}%`
        : `₹${order.coupon.discount}`}`);
      doc.text(`Discount Applied: -₹${(order.couponDiscount || 0).toFixed(2)}`);
    }

    doc.moveDown();
    doc.font('Helvetica-Bold').text(`Total Amount: ₹${order.totalAmount.toFixed(2)}`, {
      align: 'right',
    });

    doc.end();
  } catch (error) {
    console.error('Invoice generation error:', error.stack || error);
    res.status(500).send('Could not generate invoice');
  }
};
exports.cancelOrder = async (req, res) => {
  const orderId = req.params.id;

  try {
    const order = await Order.findById(orderId)
      .populate('products.product')
      .populate('coupon');

    if (!order) {
      req.flash('error', 'Order not found');
      return res.redirect('/user/orders');
    }

    if (order.coupon) {
      req.flash('error', 'Cannot cancel orders with applied coupons');
      return res.redirect('/user/orders');
    }

    if (!['Pending', 'Placed'].includes(order.status)) {
      req.flash('error', 'Order cannot be cancelled at this stage');
      return res.redirect('/user/orders');
    }

    // Restock and mark items as cancelled
    for (let item of order.products) {
      if (item.product) {
        item.product.quantity += item.quantity;
        await item.product.save();
        item.status = 'Cancelled';
      }
    }

    // Update order status
    order.status = 'User Cancelled';
    order.statusHistory.push({ status: 'User Cancelled', updatedAt: new Date() });
    await order.save();

    // Refund to wallet
    const userDoc = await User.findById(order.user); // fresh doc, not populated
    if (!userDoc.wallet) {
      userDoc.wallet = { balance: 0, transactions: [] };
    }

    const refundAmount = order.totalAmount;
    userDoc.wallet.balance += refundAmount;
    userDoc.wallet.transactions.push({
      date: new Date(),
      type: 'Credit',
      amount: refundAmount,
      reason: 'Cancelled entire order',
      orderId: order._id.toString()
    });

    await userDoc.save({ validateBeforeSave: false });

    req.flash('success', `Order cancelled. ₹${refundAmount} refunded to your wallet.`);
    return res.redirect('/user/orders');

  } catch (err) {
    console.error('Error canceling order:', err);
    req.flash('error', 'Failed to cancel order');
    return res.redirect('/user/orders');
  }
};

// Get Products
exports.getProducts = async (req, res) => {
  try {
    const { search, category, sort, page = 1 } = req.query;
    const perPage = 12;
    const skip = (page - 1) * perPage;
    const query = { isBlocked: false };

    // Your existing filtering logic for category, search, etc.

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
        stock: typeof product.stock === 'number' ? product.stock : 0 // ✅ Ensure it's a number
      };
    }));

    // Re-sort if needed
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
    console.log("this is wishlist",wishlist)

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
    }).populate('category').populate('offers'); 

    if (!product) {
      return res.status(404).send('Product not found or is unavailable');
    }

    //offer
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
    res.status(500).send('Internal Server Error');
  }
};

//checkout
exports.checkout = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    const { productIds, quantities, productId, quantity } = req.body;
    const user = await User.findById(req.session.user._id);
    const now = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).sort({ createdAt: -1 });

    let sessionCheckout = {
      productIds: [],
      quantities: [],
      offerPrices: [],
      totalAmount: 0,
      isFromCart: false
    };

    // Cart Checkout
    if (productIds && quantities && Array.isArray(productIds) && Array.isArray(quantities)) {
      let total = 0;
      let offers = [];

      for (let i = 0; i < productIds.length; i++) {
        const product = await Product.findById(productIds[i]);
        if (!product || product.isBlocked || product.isDeleted) continue;

        const qty = parseInt(quantities[i]);
        if (qty > product.quantity) {
          return res.status(400).send(`Only ${product.quantity} units available for ${product.name}`);
        }

        const offer = await product.getBestOfferPrice();
        const price = offer.price;

        total += qty * price;
        offers.push(price);

        sessionCheckout.productIds.push(product._id.toString());
        sessionCheckout.quantities.push(qty);
      }

      sessionCheckout.totalAmount = total;
      sessionCheckout.offerPrices = offers;
      sessionCheckout.isFromCart = true;

    } else if (productId && quantity) {
      const product = await Product.findById(productId);
      if (!product || product.isBlocked || product.isDeleted) {
        return res.status(404).send('Product not available');
      }

      const qty = parseInt(quantity);
      if (qty > product.quantity) {
        return res.status(400).send(`Only ${product.quantity} unit(s) available for ${product.name}`);
      }

      const offer = await product.getBestOfferPrice();
      const price = offer.price;

      sessionCheckout = {
        productIds: [product._id.toString()],
        quantities: [qty],
        offerPrices: [price],
        totalAmount: qty * price,
        isFromCart: false
      };
    } else {
      return res.redirect('/cart');
    }

    req.session.checkout = sessionCheckout;
    return res.redirect('/user/checkout');

  } catch (err) {
    console.error('Checkout POST error:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.getCheckout = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    let checkout = req.session.checkout;
    const user = await User.findById(req.session.user._id);

    // ✅ Handle retry case
    if ((!checkout || !checkout.productIds || checkout.productIds.length === 0) && req.session.retryOrderId) {
      const retryOrder = await Order.findById(req.session.retryOrderId).populate('products.product');

      if (!retryOrder) {
        return res.status(404).render('user/error', { message: 'Retry order not found' });
      }

      checkout = {
        productIds: retryOrder.products.map(p => p.product._id.toString()),
        quantities: retryOrder.products.map(p => p.quantity),
        offerPrices: retryOrder.products.map(p => p.product.price), // Or a better offer logic
        totalAmount: retryOrder.totalAmount,
        isRetry: true,
        orderId: retryOrder._id
      };
    }

    if (!checkout || !checkout.productIds || checkout.productIds.length === 0) {
      return res.redirect('/cart');
    }

    const { productIds, quantities, offerPrices, totalAmount } = checkout;
    const cart = [];

    for (let i = 0; i < productIds.length; i++) {
      const product = await Product.findById(productIds[i]);
      const offerDetails = await product.getBestOfferPrice();
      cart.push({ product, quantity: quantities[i], offerDetails });
    }

    const now = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).sort({ createdAt: -1 });

    res.render('user/checkout', {
      user,
      cart,
      addresses: user.addresses || [],
      totalAmount,
      coupons,
      session: req.session,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      walletBalance: (user.wallet && user.wallet.balance) || 0
    });

  } catch (error) {
    console.error('Checkout GET error:', error);
    res.status(500).render('user/error', { message: 'Failed to load checkout' });
  }
};

exports.retryPayment = async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await Order.findById(orderId).populate('products.product');

    if (!order) return res.status(404).send('Order not found');
    if (order.status !== 'Pending') return res.redirect(`/user/order/${orderId}`);

    req.session.retryOrder = order; // Temporarily store order for reuse
    res.redirect('/checkout');
  } catch (err) {
    console.error('Retry Payment Error:', err);
    res.status(500).send('Server error');
  }
};
exports.retryCheckout = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    const userId = req.session.user._id;

    // Get the most recent failed or pending order
    const lastOrder = await Order.findOne({
      user: userId,
      paymentStatus: { $in: ['failed', 'pending'] }
    }).sort({ createdAt: -1 });

    if (!lastOrder || !lastOrder.products || lastOrder.products.length === 0) {
      return res.redirect('/cart');
    }

    const sessionCheckout = {
      productIds: [],
      quantities: [],
      offerPrices: [],
      totalAmount: 0,
      isFromCart: false
    };

    for (const item of lastOrder.products) {
      const product = await Product.findById(item.product);
      if (!product || product.isBlocked || product.isDeleted) continue;

      sessionCheckout.productIds.push(product._id.toString());
      sessionCheckout.quantities.push(item.quantity);
      sessionCheckout.offerPrices.push(item.price); // fallback
      sessionCheckout.totalAmount += item.quantity * item.price;
    }

    req.session.checkout = sessionCheckout;
    return res.redirect('/user/checkout');
  } catch (err) {
    console.error('Retry checkout error:', err);
    res.status(500).redirect('/cart');
  }
};

exports.retryCheckoutWithOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user?._id;

    if (!userId) return res.redirect('/login');

    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate('products.product');

    if (!order || order.paymentStatus !== 'failed') {
      return res.redirect('/user/orders');
    }

    const sessionCheckout = {
      productIds: [],
      quantities: [],
      offerPrices: [],
      totalAmount: 0,
      isFromCart: false,
      addressId: order.address._id, // optional
      couponId: order.coupon?._id || null // optional
    };

    for (const item of order.products) {
      const product = item.product;
      if (!product || product.isBlocked || product.isDeleted || product.stock < item.quantity) {
        continue;
      }

      sessionCheckout.productIds.push(product._id.toString());
      sessionCheckout.quantities.push(item.quantity);
      sessionCheckout.offerPrices.push(item.price);
      sessionCheckout.totalAmount += item.quantity * item.price;
    }

    req.session.checkout = sessionCheckout;
    return res.redirect('/user/checkout');

  } catch (err) {
    console.error('Error retrying checkout with orderId:', err);
    return res.redirect('/user/orders');
  }
};

exports.createInlineAddress = async (req, res) => {
  try {
    const { name, street, city, state, zip, country, phone } = req.body;

    // Validate input
    if (!name || !street || !city || !state || !zip || !country || !phone) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required.'
      });
    }

    const user = await User.findById(req.session.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const newAddress = {
      name,
      street,
      city,
      state,
      zip,
      country,
      phone,
      default: user.addresses.length === 0
    };

    user.addresses.push(newAddress);
    await user.save();

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ Error in createInlineAddress:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.'
    });
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

    // 1. Validate checkout session
    if (!checkoutData || !Array.isArray(checkoutData.productIds)) {
      return res.status(400).send('Checkout session missing or invalid.');
    }

    const { productIds, quantities, offerPrices } = checkoutData;

    // 2. Get user
    const user = await User.findById(req.session.user._id);
    if (!user) return res.status(404).send('User not found');

    // 3. Get selected address
    const address = user.addresses.id(selectedAddress);
    if (!address) return res.status(404).send('Address not found');

    // 4. Get products
    const products = await Product.find({ _id: { $in: productIds } });
    if (products.length !== productIds.length) {
      return res.status(404).send('One or more products not found');
    }

    // 5. Calculate totals
    let totalAmount = 0;
    const orderItems = [];

    for (let i = 0; i < products.length; i++) {
      const quantity = parseInt(quantities[i]);
      const price = parseFloat(offerPrices[i]);
      totalAmount += price * quantity;
      orderItems.push({ product: products[i], quantity, offerPrice: price });
    }

    const discountAmount = calculateDiscountAmount(products, quantities, offerPrices);
    let deliveryCharge = totalAmount < 50000 ? 80 : 0;
    totalAmount += deliveryCharge;

    // 6. Apply coupon if any
    let couponDiscount = 0;
    if (req.session.coupon?.discountAmount) {
      const discount = parseFloat(req.session.coupon.discountAmount);
      if (!isNaN(discount) && discount > 0 && discount <= totalAmount) {
        couponDiscount = discount;
        totalAmount -= discount;
      }
    }

    // 7. Payment method restrictions
    if (paymentMethod === 'COD' && totalAmount > 20000) {
      return res.status(400).send('COD is only available for orders up to ₹20,000.');
    }
    if (paymentMethod === 'Online' && totalAmount > 450000) {
      return res.status(400).send('Online payments above ₹4.5 Lakhs not supported.');
    }
    if (paymentMethod === 'Wallet' && (!user.wallet || user.wallet.balance < totalAmount)) {
      return res.status(400).send('Insufficient wallet balance.');
    }

    // 8. Create estimated delivery date
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + 6);

    // 9. Create order first
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
      status:
        paymentMethod === 'COD'
          ? 'Placed'
          : paymentMethod === 'Wallet'
          ? 'Paid'
          : 'Pending',
      discountAmount,
      couponDiscount
    });

    // 10. Wallet payment handling AFTER order is created
    if (paymentMethod === 'Wallet') {
      user.wallet.balance -= totalAmount;
      user.wallet.transactions.push({
        type: 'Debit',
        amount: totalAmount,
        reason: 'Order payment',
        orderId: createdOrder._id.toString(),
        date: new Date()
      });
      await user.save();
    }

    // 11. Update stock
    for (let i = 0; i < products.length; i++) {
      const quantityOrder = parseInt(quantities[i]);
      await Product.findByIdAndUpdate(products[i]._id, {
        $inc: { quantity: -quantityOrder }
      });
    }

    // 12. Remove items from cart
    await Cart.updateOne(
      { user: req.session.user._id },
      { $pull: { items: { product: { $in: productIds } } } }
    );

    // 13. Save to session
    req.session.orderItems = orderItems;
    req.session.address = address;
    req.session.paymentMethod = paymentMethod;
    req.session.totalAmount = totalAmount;
    req.session.deliveryCharge = deliveryCharge;
    req.session.arrivalDate = estimatedDate;
    req.session.couponDiscount = couponDiscount;
    req.session.orderId = createdOrder._id;
    req.session.paymentVerified = paymentMethod === 'Wallet';

    // 14. Render confirmation
    res.render('user/order-confirmation', {
      orderItems,
      address,
      paymentMethod,
      totalAmount,
      deliveryCharge,
      estimatedDate,
      orderId: createdOrder._id,
      paymentVerified: req.session.paymentVerified,
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
    if (req.session.orderId) {
  return res.redirect('/user/confirm-payment'); // Order already created
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
      couponDiscount 
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
  const userId = req.session.user?._id; 
  const { name } = req.body;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized. Please log in.' });
  }

  if (!name || name.trim() === '') {
    return res.status(400).json({ message: 'Name cannot be empty.' });
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name: name.trim() }, 
      { new: true, runValidators: true } 
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.redirect('/user/profile'); 
  } catch (error) {
    console.error('Error updating user name:', error);
    res.status(500).json({ message: 'An error occurred while updating the name.' });
  }
};
//forget password
exports.getForgotPasswordPage = (req, res) => {
  res.render('user/forgot-password', { error: null });
};


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

// Handle Reset Password
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

    const order = await Order.findById(orderId)
      .populate('products.product')
      .populate('coupon');

    if (!order) {
      req.flash('error', 'Order not found');
      return res.redirect('/user/orders');
    }

    if (order.coupon) {
      req.flash('error', 'Cannot return products from orders with applied coupons');
      return res.redirect(`/user/orders/${orderId}`);
    }

    if (order.status !== 'Delivered') {
      req.flash('error', 'Only delivered orders can be returned');
      return res.redirect(`/user/orders/${orderId}`);
    }

    if (!reason || reason.trim() === '') {
      req.flash('error', 'Return reason is required');
      return res.redirect(`/user/orders/${orderId}`);
    }

    const productEntry = order.products.find(
      item => item.product._id.toString() === productId
    );

    if (!productEntry) {
      req.flash('error', 'Product not found in order');
      return res.redirect(`/user/orders/${orderId}`);
    }

    // Parse quantity safely
    const qty = parseInt(quantity || productEntry.quantity, 10);

    // Use stored price snapshot from order, fallback to populated product price
    const unitPrice = Number(productEntry.unitPrice || productEntry.price || 0);
    const refundAmount = unitPrice * qty;

    console.log('Refund calculation:', {
      qty,
      storedUnitPrice: productEntry.unitPrice,
      productEntryPrice: productEntry.price,
      populatedProductPrice: productEntry.product?.price,
      refundAmount
    });

    // Save return request in order
    order.returnedItems.push({
      product: productEntry.product._id,
      quantity: qty,
      reason: reason.trim(),
    });

    order.returnRequested = true;
    order.returnStatus = 'Requested';
    await order.save();

    // Update user wallet
    const user = await User.findById(order.user);
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect(`/user/orders/${orderId}`);
    }

    user.wallet.balance = (user.wallet.balance || 0) + refundAmount;
    user.wallet.transactions.push({
      type: 'Credit',
      amount: refundAmount,
      reason: `Refund for returned product: ${productEntry.product.name || 'Product'}`,
      orderId: order._id.toString(),
    });

    await user.save();

    req.flash('success', `Return request submitted. ₹${refundAmount.toFixed(2)} credited to wallet.`);
    res.redirect(`/user/orders/${orderId}`);
  } catch (err) {
    console.error('Return product error:', err);
    req.flash('error', 'Failed to process return request');
    res.redirect(`/user/orders`);
  }
};


exports.returnOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId)
      .populate('coupon');

    if (!order) {
      req.flash('error', 'Order not found');
      return res.redirect('/user/orders');
    }

    // Check if coupon was used
    if (order.coupon) {
      req.flash('error', 'Cannot return orders with applied coupons');
      return res.redirect(`/user/orders/${orderId}`);
    }

    if (order.status !== 'Delivered') {
      req.flash('error', 'Only delivered orders can be returned');
      return res.redirect(`/user/orders/${orderId}`);
    }

    order.status = 'Return Requested';
    order.returnRequested = true;
    order.returnStatus = 'Requested';
    await order.save();

    req.flash('success', 'Return request submitted successfully');
    res.redirect(`/user/orders/${orderId}`);
  } catch (err) {
    console.error('Error returning order:', err);
    req.flash('error', 'Failed to process return request');
    res.redirect(`/user/orders/${orderId}`);
  }
};

exports.cancelSingleItem = async (req, res) => {
  const { orderId, productId } = req.params;
  const qtyToCancel = parseInt(req.body.quantity, 10);
  const reason = req.body.reason || 'No reason provided';

  try {
    const order = await Order.findById(orderId).populate('products.product');

    if (!order) {
      req.flash('error', 'Order not found');
      return res.redirect('/user/orders');
    }

    if (order.coupon) {
      req.flash('error', 'Cannot cancel items from orders with applied coupons');
      return res.redirect(`/user/order/${orderId}`);
    }

    if (order.status !== 'Pending') {
      req.flash('error', 'Order cannot be modified at this stage');
      return res.redirect(`/user/order/${orderId}`);
    }

    const itemIndex = order.products.findIndex(p =>
      p.product._id
        ? p.product._id.toString() === productId
        : p.product.toString() === productId
    );

    if (itemIndex === -1) {
      req.flash('error', 'Product not found in order');
      return res.redirect(`/user/order/${orderId}`);
    }

    const item = order.products[itemIndex];

    if (qtyToCancel > item.quantity || qtyToCancel < 1) {
      req.flash('error', 'Invalid quantity to cancel');
      return res.redirect(`/user/order/${orderId}`);
    }

    // Refund calculation
    const price = item.product.salesPrice || item.product.regularPrice;
    const refundAmount = price * qtyToCancel;

    // Restock product
    await Product.findByIdAndUpdate(productId, { $inc: { quantity: qtyToCancel } });

    // Refund to wallet
    await User.findByIdAndUpdate(order.user, {
  $inc: { 'wallet.balance': refundAmount },
  $push: {
    'wallet.transactions': {
      type: 'Refund',
      amount: refundAmount,
      reason: reason,
      orderId: order.orderId,
      date: new Date()
    }
  }
});
    // Update order item quantity or status
    if (qtyToCancel === item.quantity) {
      item.status = 'Cancelled';
    } else {
      item.quantity -= qtyToCancel;
    }
    item.cancellationReason = reason;

    // Adjust total amount
    order.totalAmount -= refundAmount;

    // If all items are cancelled, mark order as cancelled
    const allCancelled = order.products.every(p => p.status === 'Cancelled');
    if (allCancelled) {
      order.status = 'User Cancelled';
    }

    await order.save();

    req.flash('success', `Cancelled ${qtyToCancel} unit(s). Reason: ${reason}`);
    res.redirect(`/user/order/${orderId}`);
  } catch (err) {
    console.error('Cancel single item error:', err);
    req.flash('error', 'Failed to cancel item');
    res.redirect(`/user/order/${orderId}`);
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
      return res.status(404).send('User not found');
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
    res.status(500).send('Internal Server Error');
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
    res.status(500).render('user/error', { message: 'Unable to load wallet page' });
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
      return res.status(404).json({ success: false, message: 'Product not found or unavailable' });
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const existingItem = cart.items.find(item => item.product.toString() === productId);

    if (existingItem) {
      if (existingItem.quantity >= 5) {
        return res.status(400).json({ success: false, message: 'Maximum quantity reached for this item' });
      }
      existingItem.quantity += 1;
    } else {
      cart.items.push({ product: productId, quantity: 1 });
    }

    await cart.save();

    // Remove from wishlist
    await Wishlist.updateOne(
      { user: userId },
      { $pull: { products: productId } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Add to cart from wishlist error:", error);
    res.status(500).json({ success: false, message: 'Failed to add item to cart' });
  }
};

