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

//Order
exports.viewOrders = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { 
      sortBy = 'newest', 
      page = 1,
      search = '',
      status = '',
      dateRange = ''
    } = req.query;

    let filterCriteria = { user: userId };

    if (search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      
      if (/^[A-Z0-9]+$/.test(search.trim().toUpperCase())) {
        filterCriteria.orderId = searchRegex;
      } else {
        const ordersWithProducts = await Order.aggregate([
          { $match: { user: userId } },
          { $unwind: '$products' },
          {
            $lookup: {
              from: 'products',
              localField: 'products.product',
              foreignKey: '_id',
              as: 'productDetails'
            }
          },
          { $unwind: '$productDetails' },
          {
            $match: {
              'productDetails.name': searchRegex
            }
          },
          { $group: { _id: '$_id' } }
        ]);
        
        const orderIds = ordersWithProducts.map(order => order._id);
        if (orderIds.length > 0) {
          filterCriteria._id = { $in: orderIds };
        } else {
          filterCriteria._id = { $in: [] };
        }
      }
    }

    if (status && status !== 'all') {
      filterCriteria.status = status.toLowerCase();
    }

    if (dateRange && dateRange !== 'all') {
      const today = new Date();
      let startDate = new Date();
      
      switch(dateRange) {
        case '7days':
          startDate.setDate(today.getDate() - 7);
          break;
        case '30days':
          startDate.setDate(today.getDate() - 30);
          break;
        case '3months':
          startDate.setMonth(today.getMonth() - 3);
          break;
        case '6months':
          startDate.setMonth(today.getMonth() - 6);
          break;
        case '1year':
          startDate.setFullYear(today.getFullYear() - 1);
          break;
        default:
          startDate = null;
      }
      
      if (startDate) {
        filterCriteria.createdAt = { 
          $gte: startDate,
          $lte: today 
        };
      }
    }

    let sortCriteria = {};
    switch (sortBy) {
      case 'oldest':
        sortCriteria = { createdAt: 1 };
        break;
      case 'amount_high':
        sortCriteria = { totalAmount: -1 };
        break;
      case 'amount_low':
        sortCriteria = { totalAmount: 1 };
        break;
      case 'newest':
      default:
        sortCriteria = { createdAt: -1 };
        break;
    }

    const ordersPerPage = 5;
    const skip = (parseInt(page) - 1) * ordersPerPage;

    const orders = await Order.find(filterCriteria)
      .sort(sortCriteria)
      .skip(skip)
      .limit(ordersPerPage)
      .populate('products.product', 'name images')
      .lean();

    const totalOrders = await Order.countDocuments(filterCriteria);
    const totalPages = Math.ceil(totalOrders / ordersPerPage);

    const getStatusClass = (orderStatus, returnStatus) => {
      if (returnStatus && ['Requested', 'Approved', 'Rejected'].includes(returnStatus)) {
        return 'status-returned';
      }
      switch (orderStatus?.toLowerCase()) {
        case 'delivered': return 'status-delivered';
        case 'pending': return 'status-pending';
        case 'shipped': return 'status-shipped';
        case 'cancelled': return 'status-cancelled';
        case 'returned': return 'status-returned';
        default: return 'status-pending';
      }
    };

    const generatePageUrl = (pageNum) => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (sortBy) params.set('sortBy', sortBy);
      if (dateRange) params.set('dateRange', dateRange);
      params.set('page', pageNum);
      return `/user/orders?${params.toString()}`;
    };

    res.render('user/UserOrder', { 
      orders, 
      sortBy, 
      currentPage: parseInt(page), 
      totalPages,
      searchQuery: search,
      statusFilter: status,
      dateRange,
      getStatusClass,
      generatePageUrl,
      hasFilters: !!(search || status || dateRange),
      totalOrders
    });

  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).render('error', { 
      message: 'Error loading orders',
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
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

    const doc = new PDFDocument({ 
      size: 'A4',
      margin: 50,
      bufferPages: true,
      info: {
        Title: `Invoice ${order.orderId}`,
        Author: 'Keitai',
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${order.orderId}.pdf`
    );

    doc.pipe(res);

    const primaryColor = '#3498db';
    const secondaryColor = '#2c3e50';
    const lightColor = '#f8f9fa';
    const darkColor = '#343a40';
    const successColor = '#28a745';

    const addHorizontalLine = (y, width = 550) => {
      doc.moveTo(50, y).lineTo(50 + width, y).stroke(primaryColor).lineWidth(1);
    };

    doc.fillColor(secondaryColor)
       .fontSize(24)
       .font('Helvetica-Bold')
       .text('INVOICE', 50, 50, { align: 'left' });

    doc.fillColor(primaryColor)
       .fontSize(10)
       .text(`#${order.orderId}`, 50, 80);

    doc.fillColor(darkColor)
       .fontSize(10)
       .text('Keitai', 400, 50, { align: 'right' })
       .text('Pai Road, Palluruthy', 400, 65, { align: 'right' })
       .text('Kochi, ernakulam, 682006', 400, 80, { align: 'right' })
       .text('Phone: 89211xxxxx', 400, 95, { align: 'right' })
       .text('Email: keitai@gmail.com', 400, 110, { align: 'right' });

    addHorizontalLine(130);

    doc.fillColor(secondaryColor)
       .fontSize(12)
       .text('Invoice Date:', 50, 150)
       .text(new Date(order.createdAt).toLocaleDateString(), 150, 150);

    doc.text('Payment Method:', 50, 170)
       .fillColor(primaryColor)
       .text(order.paymentMethod, 150, 170);

    doc.fillColor(secondaryColor)
       .text('Status:', 50, 190)
       .fillColor(successColor)
       .text(order.status, 150, 190);

    doc.fillColor(secondaryColor)
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('BILLING ADDRESS', 50, 230);

    doc.fillColor(darkColor)
       .fontSize(11)
       .text(selectedAddress.name, 50, 255)
       .text(selectedAddress.street, 50, 270)
       .text(`${selectedAddress.city}, ${selectedAddress.state} ${selectedAddress.zip}`, 50, 285)
       .text(selectedAddress.country, 50, 300)
       .text(`Phone: ${selectedAddress.phone}`, 50, 315);

    addHorizontalLine(350);

    const productsStartY = 370;
    doc.fillColor(lightColor)
       .rect(50, productsStartY, 500, 20)
       .fill();

    doc.fillColor(secondaryColor)
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('#', 50, productsStartY + 5)
       .text('Product', 80, productsStartY + 5)
       .text('Price', 350, productsStartY + 5, { width: 80, align: 'right' })
       .text('Qty', 430, productsStartY + 5, { width: 40, align: 'right' })
       .text('Total', 470, productsStartY + 5, { width: 80, align: 'right' });

    let subtotal = 0;
    let currentY = productsStartY + 30;

    order.products.forEach((item, index) => {
      const price = item.product.salesPrice || item.product.regularPrice || 0;
      const total = price * item.quantity;
      subtotal += total;

      if (index % 2 === 0) {
        doc.fillColor(lightColor)
           .rect(50, currentY - 10, 500, 20)
           .fill();
      }

      doc.fillColor(darkColor)
         .fontSize(10)
         .text(`${index + 1}.`, 50, currentY)
         .text(item.product.name, 80, currentY, { width: 250 })
         .text(`₹${price.toFixed(2)}`, 350, currentY, { width: 80, align: 'right' })
         .text(item.quantity.toString(), 430, currentY, { width: 40, align: 'right' })
         .text(`₹${total.toFixed(2)}`, 470, currentY, { width: 80, align: 'right' });

      currentY += 20;
    });

    const summaryStartY = currentY + 20;
    addHorizontalLine(summaryStartY - 10);

    doc.fillColor(secondaryColor)
       .fontSize(12)
       .text('Subtotal:', 400, summaryStartY, { width: 80, align: 'right' })
       .text(`₹${subtotal.toFixed(2)}`, 470, summaryStartY, { width: 80, align: 'right' });

    if (order.deliveryCharge && order.deliveryCharge > 0) {
      doc.text('Delivery:', 400, summaryStartY + 20, { width: 80, align: 'right' })
         .text(`₹${order.deliveryCharge.toFixed(2)}`, 470, summaryStartY + 20, { width: 80, align: 'right' });
    }

    if (order.coupon) {
      doc.text('Discount:', 400, summaryStartY + 40, { width: 80, align: 'right' })
         .fillColor(successColor)
         .text(`-₹${(order.couponDiscount || 0).toFixed(2)}`, 470, summaryStartY + 40, { width: 80, align: 'right' })
         .fillColor(secondaryColor);
    }

    doc.fillColor(secondaryColor)
       .font('Helvetica-Bold')
       .text('Total Amount:', 400, summaryStartY + 70, { width: 80, align: 'right' })
       .fillColor(primaryColor)
       .fontSize(14)
       .text(`₹${order.totalAmount.toFixed(2)}`, 470, summaryStartY + 70, { width: 80, align: 'right' });

    const footerY = doc.page.height - 100;
    addHorizontalLine(footerY - 20);

    doc.fillColor(secondaryColor)
       .fontSize(10)
       .text('Thank you for your business!', 50, footerY, { align: 'center' })
       .text('Terms & Conditions: Payment due within 15 days', 50, footerY + 15, { align: 'center' })
       .text('Questions? Email: support@yourcompany.com', 50, footerY + 30, { align: 'center' });

    doc.on('pageAdded', () => {
      doc.fontSize(10)
         .fillColor(darkColor)
         .text(`Page ${doc.bufferedPageRange().count}`, 50, doc.page.height - 30);
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
      .populate("products.product")
      .populate("coupon");

    if (!order) {
      req.flash("error", "Order not found");
      return res.redirect("/user/orders");
    }

    if (order.coupon) {
      req.flash("error", "Cannot cancel orders with applied coupons");
      return res.redirect("/user/orders");
    }

    if (!["Pending", "Placed"].includes(order.status)) {
      req.flash("error", "Order cannot be cancelled at this stage");
      return res.redirect("/user/orders");
    }

    for (let item of order.products) {
      if (item.product && item.status !== "Cancelled") {
        item.product.quantity += item.quantity;
        await item.product.save();
        item.status = "Cancelled";
        item.cancelledAt = new Date();
      }
    }

    order.status = "User Cancelled";
    order.statusHistory.push({
      status: "User Cancelled",
      updatedAt: new Date(),
    });
    order.paymentStatus = "Refunded";

    let refundAmount = 0;

    if (order.paymentMethod !== "COD" && order.paymentStatus === "Refunded") {
      refundAmount = order.products.reduce(
        (sum, p) => sum + (p.quantity * (p.unitPrice || p.product.salesPrice || 0)),
        0
      );

      await User.findByIdAndUpdate(order.user, {
        $inc: { "wallet.balance": refundAmount },
        $push: {
          "wallet.transactions": {
            type: "Credit",
            amount: refundAmount,
            reason: "Cancelled entire order",
            orderId: order._id.toString(),
            date: new Date(),
          },
        },
      });

      req.flash("success", `₹${refundAmount} refunded to your wallet.`);
    }

    await order.save();

    return res.redirect("/user/orders");
  } catch (err) {
    console.error("Error canceling order:", err);
    req.flash("error", "Failed to cancel order");
    return res.redirect("/user/orders");
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

// Retry Payment
exports.retryPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).send("Order ID missing");

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).send("Order not found");

    req.session.retryOrderId = order._id;
    req.session.checkout = {
      productIds: order.products.map(p => p.product),
      quantities: order.products.map(p => p.quantity),
      offerPrices: order.products.map(p => p.unitPrice)
    };

    return res.redirect('/user/checkout');
  } catch (err) {
    console.error("Retry Payment Error:", err);
    res.status(500).send("Server error");
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

exports.paymentFailed = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).send("Order not found");

    order.status = "Pending";
    order.paymentStatus = "failed";
    await order.save();

    req.flash("error", "Payment failed. Please retry payment.");
    return res.redirect(`/order/${order._id}`); 
  } catch (err) {
    console.error("Error marking order failed:", err.message);
    res.status(500).send("Internal Server Error");
  }
};


// Confirm Payment




//settings
exports.getSettingsPage = (req, res) => {
  //console.log("Navigating to settings page.");
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
    return res.redirect('/forgot-password'); 
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

    const order = await Order.findById(id).populate("products.product");

    if (!order) {
      req.flash("error", "Order not found");
      return res.redirect("/user/orders");
    }

    if (!["Pending", "Placed"].includes(order.status)) {
      req.flash("error", "Order cannot be cancelled at this stage.");
      return res.redirect("/user/orders");
    }

    for (let item of order.products) {
      if (item.product && item.status !== "Cancelled") {
        item.product.quantity += item.quantity;
        await item.product.save();
        item.status = "Cancelled";
        item.cancelledAt = new Date();
      }
    }

    order.status = "User Cancelled";
    order.cancellationReason = reason || "";
    order.statusHistory.push({
      status: "User Cancelled",
      updatedAt: new Date(),
    });

    let refundAmount = 0;

    if (order.paymentMethod !== "COD" && order.paymentStatus === "Paid") {
      const userDoc = await User.findById(order.user);

      if (!userDoc.wallet) {
        userDoc.wallet = { balance: 0, transactions: [] };
      }

      refundAmount = order.totalAmount;

      userDoc.wallet.balance += refundAmount;
      userDoc.wallet.transactions.push({
        date: new Date(),
        type: "Credit",
        amount: refundAmount,
        reason: "Cancelled entire order",
        orderId: order._id.toString(),
      });

      await userDoc.save({ validateBeforeSave: false });
      order.paymentStatus = "Refunded";
    }

    await order.save();

    if (refundAmount > 0) {
      req.flash("success", `Order cancelled. ₹${refundAmount} refunded to your wallet.`);
    } else {
      req.flash("success", "Order cancelled successfully.");
    }

    return res.redirect("/user/orders");
  } catch (err) {
    console.error("❌ Cancel entire order error:", err);
    req.flash("error", "Failed to cancel order");
    return res.redirect("/user/orders");
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

    const alreadyReturned = order.returnedItems.find(
      item => item.product.toString() === productId
    );
    if (alreadyReturned) {
      req.flash('error', 'This product has already been returned');
      return res.redirect(`/user/orders/${orderId}`);
    }

    const qty = parseInt(quantity || productEntry.quantity, 10);

    const unitPrice = Number(productEntry.unitPrice || 0);
    const refundAmount = unitPrice * qty;

    order.returnedItems.push({
      product: productEntry.product._id,
      quantity: qty,
      reason: reason.trim(),
      refundAmount,
      status: 'Pending'
    });

    order.returnRequested = true;
    order.returnStatus = 'Requested';
    await order.save();

    const user = await User.findById(order.user);
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect(`/user/orders/${orderId}`);
    }

   if (!user.wallet) {
  user.wallet = { balance: 0, transactions: [] };
}

user.wallet.balance += refundAmount;
user.wallet.transactions.push({
  type: 'Credit',
  amount: refundAmount,
  orderId: order._id.toString(),                
  reason: `Refund for returned product ${productEntry.product?.name || 'N/A'}`, 
  date: new Date()
});

await user.save();
    req.flash('success', `Return request submitted. ₹${refundAmount.toFixed(2)} credited to wallet.`);
    res.redirect(`/user/orders/${orderId}`);
  } catch (err) {
    console.error('Return product error:', err);
    req.flash('error', 'Failed to process return request');
    res.redirect('/user/orders');
  }
};



exports.returnOrder = async (req, res) => {
  const orderId = req.params.id;

  try {
    const { reason, items } = req.body;
    //console.log("reason and item", reason, orderId);

    const order = await Order.findById(orderId).populate('coupon').populate('user');
    if (!order) {
      req.flash('error', 'Order not found');
      return res.redirect('/user/orders');
    }

    if (order.coupon) {
      req.flash('error', 'Cannot return orders with applied coupons');
      return res.redirect(`/user/orders/${orderId}`);
    }

    if (order.status !== 'Delivered') {
      req.flash('error', 'Only delivered orders can be returned');
      return res.redirect(`/user/orders/${orderId}`);
    }

    if (!items || items.length === 0) {
      order.returnRequested = true;
      order.returnStatus = 'Requested';
      order.returnReason = reason || 'No reason provided';
      order.status = 'Return Requested';
      const user = await User.findById(order.user);
      if (user) {
        user.wallet.balance += order.totalAmount;
        user.wallet.transactions.push({
          type: 'Credit',
          amount: order.totalAmount,
          reason: `Refund for full return of order #${order.orderId}`,
          orderId: order._id,
          date: new Date()
        });
        await user.save();
      }

      order.statusHistory.push({ status: 'Return Requested' });
      await order.save();

      //console.log('Return requested order:', order);
      req.flash('success', 'Full order return requested. Amount refunded to wallet.');
      return res.redirect(`/user/orders/${orderId}`);
    }

    let refundTotal = 0;
    items.forEach((item) => {
      const orderedProduct = order.products.find(
        (p) => p.product.toString() === item.productId
      );

      if (orderedProduct && item.quantity <= orderedProduct.quantity) {
        const refundAmount = orderedProduct.unitPrice * item.quantity;
        refundTotal += refundAmount;

        order.returnedItems.push({
          product: item.productId,
          quantity: item.quantity,
          reason: item.reason || reason,
          refundAmount,
          status: 'Pending',
        });
      }
    });

    if (refundTotal > 0) {
      const user = await User.findById(order.user);
      if (user) {
        user.wallet.balance += refundTotal;
        user.wallet.transactions.push({
          type: 'Credit',
          amount: refundTotal,
          reason: `Refund for partial return from order #${order.orderId}`,
          orderId: order._id,
          date: new Date()
        });
        await user.save();
      }
    }

    order.returnRequested = true;
    order.returnStatus = 'Requested';
    order.status = 'Return Requested';
    order.statusHistory.push({ status: 'Return Requested' });

    await order.save();
    //console.log('Return requested order:', order);

    req.flash(
      'success',
      `Return request submitted. Refund of ₹${refundTotal || order.totalAmount} added to wallet.`
    );
    res.redirect(`/user/orders/${orderId}`);

  } catch (err) {
    console.error('Error returning order:', err);
    req.flash('error', 'Failed to process return request');
    res.redirect('/user/orders');
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

    const price = item.product.salesPrice || item.product.regularPrice;
    const refundAmount = price * qtyToCancel;

    await Product.findByIdAndUpdate(productId, { $inc: { quantity: qtyToCancel } });

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
    if (qtyToCancel === item.quantity) {
      item.status = 'Cancelled';
    } else {
      item.quantity -= qtyToCancel;
    }
    item.cancellationReason = reason;

    order.totalAmount -= refundAmount;

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
    const user = await User.findById(req.session.user._id).lean(); 

    if (!user.wallet) {
      user.wallet = { balance: 0, transactions: [] }; 
    }

    res.render('user/wallet', {
      user
    });
  } catch (err) {
    console.error('Error loading wallet page:', err.message);
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

