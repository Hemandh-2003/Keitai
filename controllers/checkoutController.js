const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Coupon = require('../models/Coupon');
const {HTTP_STATUS}= require('../SM/status');
const { MESSAGE } = require('../SM/messages');
exports.getCheckout = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    const user = await User.findById(req.session.user._id);
    let checkout = req.session.checkout;

    // Handle retry order
    if ((!checkout || !checkout.productIds?.length) && req.session.retryOrderId) {
      const retryOrder = await Order.findById(req.session.retryOrderId).populate('products.product');
      if (retryOrder) {
        checkout = {
          productIds: retryOrder.products.map(p => p.product._id.toString()),
          quantities: retryOrder.products.map(p => p.quantity),
          offerPrices: retryOrder.products.map(p => p.unitPrice),
          totalAmount: retryOrder.totalAmount,
          orderId: retryOrder._id.toString(),
          isRetry: true
        };
        req.session.checkout = checkout;
      }
    }

    if (!checkout || !checkout.productIds?.length) {
      return res.redirect('/cart');
    }

    const cart = [];

    for (let i = 0; i < checkout.productIds.length; i++) {
      const product = await Product.findById(checkout.productIds[i]);
      if (!product) continue;
      // Assume getBestOfferPrice() returns { price, originalPrice }
      const offerDetails = await product.getBestOfferPrice();
      cart.push({
        product,
        quantity: checkout.quantities[i],
        offerDetails
      });
    }

    // Ensure cart is always an array
    const totalAmount = checkout.totalAmount || cart.reduce((sum, item) => {
      const price = item.offerDetails?.price || item.product.salesPrice || item.product.regularPrice;
      return sum + price * item.quantity;
    }, 0);

    const now = new Date();
    const coupons = await Coupon.find({ isActive: true, startDate: { $lte: now }, endDate: { $gte: now } }).sort({ createdAt: -1 });

    const validCoupons = coupons.filter(c => totalAmount >= c.minPurchase && (c.maxDiscount === 0 || totalAmount <= c.maxDiscount));

    res.render('user/checkout', {
      user,
      cart,
      addresses: user.addresses || [],
      totalAmount,
      coupons: validCoupons,
      session: req.session,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      walletBalance: user.wallet?.balance || 0
    });

  } catch (error) {
    console.error('Checkout GET error:', error);
    res.status(500).render('user/error', { message: 'Failed to load checkout' });
  }
};

exports.checkout = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    const { productIds, quantities, productId, quantity } = req.body;
    const user = await User.findById(req.session.user._id);

    let sessionCheckout = {
      productIds: [],
      quantities: [],
      offerPrices: [],
      totalAmount: 0,
      isFromCart: false
    };

    if (Array.isArray(productIds) && Array.isArray(quantities)) {
      let total = 0;
      let offers = [];

      for (let i = 0; i < productIds.length; i++) {
        const product = await Product.findById(productIds[i]);
        if (!product || product.isBlocked || product.isDeleted) continue;

        const qty = parseInt(quantities[i]);
        if (qty > product.quantity) {
          return res.status(HTTP_STATUS.BAD_REQUEST).send(`Only ${product.quantity} units available for ${product.name}`);
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
        return res.status(HTTP_STATUS.NOT_FOUND).send('Product not available');
      }

      const qty = parseInt(quantity);
      if (qty > product.quantity) {
        return res.status(HTTP_STATUS.BAD_REQUEST).send(`Only ${product.quantity} unit(s) available for ${product.name}`);
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

    if (!user.addresses || user.addresses.length === 0) {
      return res.redirect('/user/checkout');
    }

    if (!req.session.checkout.orderId) {
      const order = new Order({
        user: user._id,
        products: sessionCheckout.productIds.map((pid, index) => ({
          product: pid,
          quantity: sessionCheckout.quantities[index],
          unitPrice: sessionCheckout.offerPrices[index]
        })),
        totalAmount: sessionCheckout.totalAmount,
        selectedAddress: user.addresses[0]?._id,
        paymentMethod: "Online",
        estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: "Pending"
      });
      await order.save();
      req.session.checkout = { ...sessionCheckout, orderId: order._id.toString() };
    } else {
      req.session.checkout = { ...sessionCheckout, orderId: req.session.checkout.orderId, isRetry: true };
    }

    return res.redirect('/user/checkout');

  } catch (err) {
    console.error('Checkout POST error:', err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(MESSAGE.INTERNAL_SERVER_ERROR);
  }
};

exports.placeOrder = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    if (!userId) return res.redirect('/login');

    const { selectedAddress, paymentMethod } = req.body;

    if (!mongoose.Types.ObjectId.isValid(selectedAddress)) {
      return res.status(400).send("Please select a valid address");
    }

    const user = await User.findById(userId);
    if (!user) return res.redirect('/login');

    const addressDoc = user.addresses.id(selectedAddress);
    if (!addressDoc) return res.status(400).send("Invalid address");

    const checkoutData = req.session.checkout;
    if (!checkoutData || !checkoutData.productIds?.length) {
      return res.redirect('/cart');
    }

    const orderItems = [];

    for (let i = 0; i < checkoutData.productIds.length; i++) {
      const pid = checkoutData.productIds[i];
      const qty = Number(checkoutData.quantities[i]);
      const price = Number(checkoutData.offerPrices[i]);

      if (!mongoose.Types.ObjectId.isValid(pid)) continue;

      const product = await Product.findById(pid);
      if (!product || product.isBlocked || product.isDeleted) continue;

      if (qty > product.quantity) {
        return res.status(400).send(`Only ${product.quantity} units available for ${product.name}`);
      }

      product.quantity -= qty;
      await product.save();

      orderItems.push({
        product: product._id,
        quantity: qty,
        unitPrice: price
      });
    }

    if (!orderItems.length) return res.status(400).send("No valid items to order");

    const totalAmount = checkoutData.totalAmount || orderItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const estimatedDelivery = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create new order
    const newOrder = new Order({
      user: userId,
      products: orderItems,
      totalAmount,
      selectedAddress: addressDoc._id,
      paymentMethod,
      estimatedDelivery,
      status: paymentMethod === "COD" || paymentMethod === "Wallet" ? "Placed" : "Pending",
      paymentStatus: paymentMethod === "COD" || paymentMethod === "Wallet" ? "paid" : "pending"
    });

    await newOrder.save();

    req.session.checkout.orderId = newOrder._id;

    if (paymentMethod === "COD" || paymentMethod === "Wallet") {
      return res.redirect(`/user/order/${newOrder._id}`);
    } else {
      // For Razorpay online payment
      return res.redirect(`/user/confirm-payment`);
    }

  } catch (err) {
    console.error('placeOrder error:', err);
    res.status(500).send('Something went wrong. Please try again.');
  }
};


exports.confirmPayment = async (req, res) => {
  try {
    const checkoutData = req.session.checkout;
    const { selectedAddress, paymentMethod } = req.body;

    if (
      !checkoutData ||
      !Array.isArray(checkoutData.productIds) ||
      !Array.isArray(checkoutData.quantities)
    ) {
      return res.status(HTTP_STATUS.BAD_REQUEST).send('Checkout session missing or invalid.');
    }

    const { productIds, quantities, offerPrices } = checkoutData;

    const user = await User.findById(req.session.user._id);
    if (!user) return res.status(HTTP_STATUS.NOT_FOUND).send(MESSAGE.USER_NOT_FOUND);

    const address = user.addresses.id(selectedAddress);
    if (!address) return res.status(HTTP_STATUS.NOT_FOUND).send('Address not found');

    const products = await Product.find({ _id: { $in: productIds } });
    if (products.length !== productIds.length) {
      return res.status(HTTP_STATUS.NOT_FOUND).send('One or more products not found');
    }
    if (req.session.orderId) {
  return res.redirect('/user/confirm-payment'); 
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
        unitPrice: item.offerPrice 
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
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(err.message || MESSAGE.INTERNAL_SERVER_ERROR);
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
      couponDiscount,
      paymentVerified,
      paymentDetails,
      orderId
    } = req.session;

    if (!orderItems || !address || !paymentMethod || !totalAmount || !arrivalDate) {
      return res.status(HTTP_STATUS.BAD_REQUEST).send('Missing order details.');
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
      estimatedDate: new Date(arrivalDate), // fix for EJS
      relatedProducts,
      couponDiscount,
      paymentVerified: paymentVerified || false,
      paymentDetails: paymentDetails || {},
      orderId: orderId || null
    });
  } catch (err) {
    console.error('Error rendering confirmation page:', err.message);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(err.message || MESSAGE.INTERNAL_SERVER_ERROR);
  }
};



exports.createInlineAddress = async (req, res) => {
  try {
    const { name, street, city, state, zip, country, phone } = req.body;

    if (!name || !street || !city || !state || !zip || !country || !phone) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'All fields are required.'
      });
    }

    const user = await User.findById(req.session.user._id);
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGE.USER_NOT_FOUND
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

    res.status(HTTP_STATUS.OK).json({ success: true });
  } catch (err) {
    console.error('❌ Error in createInlineAddress:', err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
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

exports.retryCheckout = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    const userId = req.session.user._id;

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
      sessionCheckout.offerPrices.push(item.price); 
      sessionCheckout.totalAmount += item.quantity * item.price;
    }

    req.session.checkout = sessionCheckout;
    return res.redirect('/user/checkout');
  } catch (err) {
    console.error('Retry checkout error:', err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect('/cart');
  }
};


exports.retryCheckoutWithOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!req.session.user) return res.redirect('/login');

    const userId = req.session.user._id;
    const order = await Order.findOne({ _id: orderId, user: userId }).populate('products.product');
    if (!order) return res.redirect('/user/orders');

    const user = await User.findById(userId).populate('addresses');
    const coupons = await Coupon.find({
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    }).sort({ createdAt: -1 });

    const walletBalance = user.walletBalance || 0;

    const checkoutData = {
      orderId: order._id.toString(),
      productIds: order.products.map(p => p.product._id.toString()),
      quantities: order.products.map(p => p.quantity),
      offerPrices: order.products.map(p => p.unitPrice),
      totalAmount: order.totalAmount,
      isRetry: true
    };

    req.session.checkout = checkoutData;

    res.render('user/checkout', {
      user,
      addresses: user.addresses || [],
      products: order.products.map(p => ({
        product: p.product,
        quantity: p.quantity,
        offerPrice: p.unitPrice
      })),
      totalAmount: order.totalAmount,
      coupons,
      walletBalance,
      checkoutData,
      session: req.session
    });
  } catch (err) {
    console.error('retryCheckoutWithOrderId error:', err);
    res.redirect('/user/orders');
  }
};


exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      await Order.findByIdAndUpdate(orderId, { paymentStatus: 'failed', status: 'Failed' });
      return res.status(400).send("Payment verification failed");
    }

    await Order.findByIdAndUpdate(orderId, {
      paymentStatus: 'paid',
      status: 'Placed',
      razorpayPaymentId: razorpay_payment_id,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).send('Error verifying payment');
  }
};
