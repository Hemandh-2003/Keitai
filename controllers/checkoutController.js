const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Coupon = require('../models/Coupon');
const {HTTP_STATUS}= require('../SM/status');
const { MESSAGE } = require('../SM/messages');
const Razorpay = require('razorpay'); 
require('dotenv').config();
const Razorpay = require('razorpay'); 
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
exports.getCheckout = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    let checkout = req.session.checkout;
    const user = await User.findById(req.session.user._id);

    // Robust check for session data
    if ((!checkout || !Array.isArray(checkout.productIds) || !checkout.productIds.length) && req.session.retryOrderId) {
      const retryOrder = await Order.findById(req.session.retryOrderId).populate('products.product');
      if (!retryOrder) return res.status(HTTP_STATUS.NOT_FOUND).render('user/error', { message: 'Retry order not found' });

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

    if (!checkout || !Array.isArray(checkout.productIds) || !checkout.productIds.length) return res.redirect('/cart');

    const { productIds, quantities, totalAmount } = checkout;
    const cart = [];

    // NOTE: This logic recalculates product price for display purposes
    for (let i = 0; i < productIds.length; i++) {
      const product = await Product.findById(productIds[i]);
      // Safety check: skip if product is missing, blocked, or deleted
      if (!product || product.isBlocked || product.isDeleted) continue;
      const offerDetails = await product.getBestOfferPrice();
      cart.push({ product, quantity: quantities[i], offerDetails });
    }

    const now = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).sort({ createdAt: -1 });

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
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('user/error', { message: 'Failed to load checkout' });
  }
};

exports.checkout = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    const { productIds, quantities, productId, quantity } = req.body;
    const user = await User.findById(req.session.user._id);

    let sessionCheckout = { productIds: [], quantities: [], offerPrices: [], totalAmount: 0, isFromCart: false };

    if (productIds && quantities && Array.isArray(productIds) && Array.isArray(quantities)) {
      let total = 0, offers = [];
      for (let i = 0; i < productIds.length; i++) {
        const product = await Product.findById(productIds[i]);
        if (!product || product.isBlocked || product.isDeleted) continue;
        const qty = parseInt(quantities[i]);
        if (qty > product.quantity) return res.status(HTTP_STATUS.BAD_REQUEST).send(`Only ${product.quantity} units available for ${product.name}`);
        const offer = await product.getBestOfferPrice();
        total += qty * offer.price;
        offers.push(offer.price);
        sessionCheckout.productIds.push(product._id.toString());
        sessionCheckout.quantities.push(qty);
      }
      sessionCheckout.totalAmount = total;
      sessionCheckout.offerPrices = offers;
      sessionCheckout.isFromCart = true;

    } else if (productId && quantity) {
      const product = await Product.findById(productId);
      if (!product || product.isBlocked || product.isDeleted) return res.status(HTTP_STATUS.NOT_FOUND).send('Product not available');
      const qty = parseInt(quantity);
      if (qty > product.quantity) return res.status(HTTP_STATUS.BAD_REQUEST).send(`Only ${product.quantity} unit(s) available for ${product.name}`);
      const offer = await product.getBestOfferPrice();
      sessionCheckout = {
        productIds: [product._id.toString()],
        quantities: [qty],
        offerPrices: [offer.price],
        totalAmount: qty * offer.price,
        isFromCart: false
      };
    } else return res.redirect('/cart');

    req.session.checkout = sessionCheckout;
    return res.redirect('/user/checkout');

  } catch (err) {
    console.error('Checkout POST error:', err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Internal Server Error');
  }
};


exports.placeOrder = async (req, res) => {
  try {
    const { selectedAddress, paymentMethod } = req.body;
    const checkoutData = req.session.checkout;

    if (!checkoutData || !Array.isArray(checkoutData.productIds)) return res.status(HTTP_STATUS.BAD_REQUEST).send("Checkout session missing or invalid.");

    const { productIds, quantities, totalAmount: sessionTotal } = checkoutData; // Removed offerPrices from destructuring
    const user = await User.findById(req.session.user._id);
    if (!user) return res.status(HTTP_STATUS.NOT_FOUND).send("User not found");

    const address = user.addresses.id(selectedAddress);
    if (!address) return res.status(HTTP_STATUS.NOT_FOUND).send("Address not found");

    // Fetch products based on IDs
    const products = await Product.find({ _id: { $in: productIds } });
    if (products.length !== productIds.length) return res.status(HTTP_STATUS.NOT_FOUND).send("One or more products not found");

    // **CRITICAL FIX: RECALCULATE FINAL PRICE FROM DATABASE**
    let subTotalAmount = 0; // Renamed to subTotalAmount for clarity before adding charges/discounts
    const orderItems = [];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const qty = parseInt(quantities[i]);
      
      if (qty > product.quantity) return res.status(HTTP_STATUS.BAD_REQUEST).send(`Insufficient stock for ${product.name}`);
      
      // Get the current best offer price directly from the product model/DB
      const offer = await product.getBestOfferPrice(); 
      const currentPrice = offer.price; 

      subTotalAmount += currentPrice * qty;
      orderItems.push({ product: product._id, quantity: qty, unitPrice: currentPrice }); // Store product ID, not the object
      
      // Update the product stock (deduct quantity)
      product.quantity -= qty;
      await product.save();
    }
    
    let totalAmount = subTotalAmount; // Start final total calculation
    
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

    // Payment validation
    if (paymentMethod === "COD" && totalAmount > 20000) return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: "COD limit exceeded." });
    if (paymentMethod === "Wallet" && (!user.wallet || user.wallet.balance < totalAmount)) return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: "Insufficient wallet balance." });
    if (paymentMethod === "Online" && totalAmount > 450000) return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: "Online payment limit exceeded." });
    
    // Ensure all response methods return JSON for AJAX compatibility
    if (paymentMethod === "COD" || paymentMethod === "Wallet") {
      const order = await Order.create({
        user: user._id,
        selectedAddress: address._id,
        products: orderItems,
        totalAmount,
        paymentMethod,
        deliveryCharge,
        estimatedDelivery: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        status: paymentMethod === "COD" ? "Placed" : "Paid",
        couponDiscount
      });

      if (paymentMethod === "Wallet") {
        user.wallet.balance -= totalAmount;
        await user.save();
      }

      req.session.checkout = null;
      req.session.coupon = null;
      return res.json({ success: true, redirectUrl: '/user/confirm-payment' });
    }

    // ONLINE PAYMENT - Now only creates the order session, but does NOT create the Razorpay ID.
    // The EJS client will now call /user/create-razorpay-order
    
    // Save order data temporarily to session before Razorpay payment starts
    req.session.pendingOrderData = {
        products: orderItems,
        selectedAddress: address._id,
        totalAmount,
        paymentMethod,
        deliveryCharge,
        couponDiscount
    };

    // Return the total amount needed for Razorpay to the client
    res.json({ success: true, totalAmount, message: "Ready for Razorpay payment" });

  } catch (err) {
    console.error('Place Order error:', err);
    // Ensure this always returns JSON with an error message
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: "Failed to create order session: " + err.message });
  }
};


exports.renderOrderConfirmation = async (req, res) => {
  try {
    const checkoutData = req.session.checkout;
    if (!checkoutData || !checkoutData.orderData) {
      return res.redirect('/user/checkout');
    }

    const user = await User.findById(req.session.user._id);
    if (!user) return res.redirect('/user/checkout');

    const addressId = checkoutData.selectedAddress;
    const address = addressId ? user.addresses.id(addressId) : null;

    res.render('user/order-confirmation', {
      orderItems: checkoutData.orderData.orderItems || [],
      totalAmount: checkoutData.orderData.totalAmount || 0,
      deliveryCharge: checkoutData.orderData.deliveryCharge || 0,
      couponDiscount: checkoutData.orderData.couponDiscount || 0,
      paymentMethod: checkoutData.orderData.paymentMethod || "Online",
      address,
      estimatedDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      razorpayKeyId: process.env.RAZORPAY_KEY_ID, // Pass to EJS
      user: req.session.user // Pass user data for prefill
    });
  } catch (err) {
    console.error("Error rendering order confirmation:", err);
    res.status(500).send("Error loading order confirmation page.");
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
      couponDiscount
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
      arrivalDate: new Date(arrivalDate),
      relatedProducts,
      couponDiscount 
    });
  } catch (err) {
    console.error('Error rendering confirmation page:', err.message);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(err.message || MESSAGE.INTERNAL_SERVER_ERROR);
  }
};

exports.createRazorpayOrder = async (req, res) => {
  try {
    // Ensure totalAmount is a number
    let totalAmount = Number(req.body.totalAmount);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Convert to paise
    const amountInPaise = Math.round(totalAmount * 100);

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `order_rcpt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    console.log('✅ Razorpay order created:', order); // Debug log
    res.json({
      id: order.id,
      currency: order.currency,
      amount: order.amount,
    });
  } catch (err) {
    console.error('❌ createRazorpayOrder Error:', err);
    res.status(500).json({ error: 'Failed to create Razorpay order' });
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
    const userId = req.session.user?._id;

    if (!userId) return res.redirect('/login');

    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate('products.product');

    if (!order || order.paymentStatus !== 'failed') {
      return res.redirect('/user/orders');
    }

    const sessionCheckout = {
      productIds: order.products.map(p => p.product._id.toString()),
      quantities: order.products.map(p => p.quantity),
      offerPrices: order.products.map(p => p.price),
      totalAmount: order.totalAmount,
      isFromCart: false,
      addressId: order.address?._id || null,
      couponId: order.coupon?._id || null
    };

    req.session.checkout = sessionCheckout;
    return res.redirect('/user/checkout');
  } catch (err) {
    console.error('Error retrying checkout with orderId:', err);
    return res.redirect('/user/orders');
  }
};
exports.verifyPayment = async (req, res) => {
  try {
    console.log('🔐 verifyPayment called with:', req.body);
    
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    const checkoutData = req.session.checkout?.orderData;
    const user = await User.findById(req.session.user._id);

    console.log('Session checkout data:', checkoutData);
    console.log('User:', user?._id);

    if (!checkoutData || !user) {
      console.error('❌ Session expired or checkout data missing');
      return res.json({ success: false, error: "Session expired. Please try again." });
    }

    // ✅ Verify Razorpay signature
    const crypto = require("crypto");
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.error('❌ Invalid Razorpay signature');
      return res.json({ success: false, error: "Invalid payment signature" });
    }

    console.log('✅ Payment signature verified, creating order...');

    // ✅ Create order after successful verification
    const order = await Order.create({
      user: user._id,
      selectedAddress: req.session.checkout.selectedAddress,
      products: checkoutData.orderItems.map(i => ({
        product: i.product._id,
        quantity: i.quantity,
        unitPrice: i.offerPrice,
      })),
      totalAmount: checkoutData.totalAmount,
      paymentMethod: "Online",
      deliveryCharge: checkoutData.deliveryCharge,
      status: "Paid",
      discountAmount: checkoutData.discountAmount,
      couponDiscount: checkoutData.couponDiscount,
      estimatedDelivery: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    });

    console.log('✅ Order created:', order._id);

    // ✅ Reduce stock
    for (let item of checkoutData.orderItems) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { quantity: -item.quantity },
      });
    }

    // ✅ Update session to render confirmation page
    req.session.orderItems = checkoutData.orderItems;
    req.session.address = user.addresses.id(req.session.checkout.selectedAddress);
    req.session.paymentMethod = "Online";
    req.session.totalAmount = checkoutData.totalAmount;
    req.session.deliveryCharge = checkoutData.deliveryCharge;
    req.session.arrivalDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
    req.session.couponDiscount = checkoutData.couponDiscount;
    req.session.orderId = order._id.toString();
    req.session.paymentVerified = true;

    console.log('✅ Session updated, redirecting to confirm-payment');

    return res.json({
      success: true,
      orderId: order._id,
      redirectUrl: "/user/confirm-payment"
    });

  } catch (err) {
    console.error("❌ verifyPayment Error:", err);
    return res.json({ success: false, error: "Payment verification failed" });
  }
};