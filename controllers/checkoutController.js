const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Coupon = require('../models/Coupon');
const {HTTP_STATUS}= require('../SM/status');
const { MESSAGE } = require('../SM/messages');
const crypto = require('crypto');
require('dotenv').config();
const Razorpay = require('razorpay'); 
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
})
exports.getCheckout = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    let checkout = req.session.checkout;
    const user = await User.findById(req.session.user._id);

    if ((!checkout || !Array.isArray(checkout.productIds) || !checkout.productIds.length) && req.session.retryOrderId) {
      const retryOrder = await Order.findById(req.session.retryOrderId).populate('products.product');
      if (!retryOrder) return res.status(HTTP_STATUS.NOT_FOUND).render('user/error', { message: 'Retry order not found' });

      checkout = {
        productIds: retryOrder.products.map(p => p.product._id.toString()),
        quantities: retryOrder.products.map(p => p.quantity),
        offerPrices: retryOrder.products.map(p => p.unitPrice),
        totalAmount: retryOrder.totalAmount,
        orderId: retryOrder._id.toString(),
        selectedAddress: retryOrder.selectedAddress?.toString(),
        isRetry: true
      };
      req.session.checkout = checkout;
    }

    if (!checkout || !Array.isArray(checkout.productIds) || !checkout.productIds.length) return res.redirect('/cart');

    const { productIds, quantities, totalAmount } = checkout;
    const cart = [];
    for (let i = 0; i < productIds.length; i++) {
      const product = await Product.findById(productIds[i]);
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
  console.log('placeOrder called. selectedAddress:', selectedAddress, 'paymentMethod:', paymentMethod);
    const checkoutData = req.session.checkout;

  if (!checkoutData || !Array.isArray(checkoutData.productIds)) return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: "Checkout session missing or invalid." });

    const { productIds, quantities, totalAmount: sessionTotal, isRetry, orderId: retryOrderId } = checkoutData;
    const user = await User.findById(req.session.user._id);
  if (!user) return res.status(HTTP_STATUS.NOT_FOUND).json({ error: "User not found" });

    // Handle retry payment - use existing address if available
    let address;
    if (isRetry && checkoutData.selectedAddress) {
      address = user.addresses.id(checkoutData.selectedAddress);
    } else {
      address = user.addresses.id(selectedAddress);
    }
    
    if (!address) {
      const available = (user.addresses || []).map(a => a._id ? a._id.toString() : a.toString());
      console.error(`Address not found for user ${user._id}. posted selectedAddress=${selectedAddress}. available addresses=${available}`);
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: "Address not found", selectedAddress: selectedAddress || null, availableAddresses: available });
    }
    const products = await Product.find({ _id: { $in: productIds } });
  if (products.length !== productIds.length) return res.status(HTTP_STATUS.NOT_FOUND).json({ error: "One or more products not found" });

    let subTotalAmount = 0; 
    const orderItems = [];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const qty = parseInt(quantities[i]);
      
  if (qty > product.quantity) return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: `Insufficient stock for ${product.name}` });
      
      const offer = await product.getBestOfferPrice(); 
      const currentPrice = offer.price; 

      subTotalAmount += currentPrice * qty;
      orderItems.push({ product: product._id, quantity: qty, unitPrice: currentPrice }); 
      
      if (!isRetry) {
        product.quantity -= qty;
        await product.save();
      }
    }
    
    let totalAmount = subTotalAmount; 
    
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

    if (paymentMethod === "COD" && totalAmount > 20000) return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: "COD limit exceeded." });
    if (paymentMethod === "Wallet" && (!user.wallet || user.wallet.balance < totalAmount)) return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: "Insufficient wallet balance." });
    if (paymentMethod === "Online" && totalAmount > 450000) return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: "Online payment limit exceeded." });

    if (paymentMethod === "COD" || paymentMethod === "Wallet") {
      let order;
      
      if (isRetry && retryOrderId) {
        order = await Order.findByIdAndUpdate(retryOrderId, {
          selectedAddress: address._id,
          products: orderItems,
          totalAmount,
          paymentMethod,
          deliveryCharge,
          estimatedDelivery: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
          status: paymentMethod === "COD" ? "Placed" : "Paid",
          paymentStatus: paymentMethod === "COD" ? "Pending" : "Paid",
          couponDiscount
        }, { new: true });
      } else {
        order = await Order.create({
          user: user._id,
          selectedAddress: address._id,
          products: orderItems,
          totalAmount,
          paymentMethod,
          deliveryCharge,
          estimatedDelivery: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
          status: paymentMethod === "COD" ? "Placed" : "Paid",
          paymentStatus: paymentMethod === "COD" ? "Pending" : "Paid",
          couponDiscount
        });
      }

      if (paymentMethod === "Wallet") {
        user.wallet.balance -= totalAmount;
        await user.save();
      }
      try {
        const sessionOrderItems = orderItems.map(oi => {
          const prod = products.find(p => p._id.toString() === oi.product.toString());
          return {
            product: {
              _id: prod?._id || oi.product,
              name: prod?.name || '',
              brand: prod?.brand || '',
              images: prod?.images || [],
              category: prod?.category || null
            },
            quantity: oi.quantity,
            offerPrice: oi.unitPrice
          };
        });

        req.session.orderItems = sessionOrderItems;
        req.session.address = address;
        req.session.paymentMethod = paymentMethod;
        req.session.totalAmount = totalAmount;
        req.session.deliveryCharge = deliveryCharge;
        req.session.arrivalDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
        req.session.couponDiscount = couponDiscount;
      } catch (sessErr) {
        console.error('Error setting session for confirm-payment:', sessErr);
      }

      req.session.checkout = null;
      req.session.coupon = null;
      return res.json({ success: true, redirectUrl: '/user/confirm-payment' });
    }
<<<<<<< HEAD

    // ONLINE PAYMENT - Now only creates the order session, but does NOT create the Razorpay ID.
    // The EJS client will now call /user/create-razorpay-order
    
    // Save order data temporarily to session before Razorpay payment starts

if (paymentMethod === "Online") {
  // Step 1: Create a pending order in MongoDB
  const order = await Order.create({
    user: user._id,
    selectedAddress: address._id,
    products: orderItems,
    totalAmount,
    paymentMethod,
    deliveryCharge,
    estimatedDelivery: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    status: "Payment Failed",
    paymentStatus: "Pending",
    couponDiscount
  });

  console.log("🟡 Pending order created before Razorpay:", order._id);

  // Step 2: Save to session so that /payment/failed or /verify-payment can find it
  req.session.pendingOrderData = {
    orderId: order._id,
    products: orderItems,
    selectedAddress: address._id,
    totalAmount,
    paymentMethod,
    deliveryCharge,
    couponDiscount,
    isRetry: isRetry || false,
    retryOrderId: retryOrderId || null
  };
=======
    req.session.pendingOrderData = {
        products: orderItems,
        selectedAddress: address._id,
        totalAmount,
        paymentMethod,
        deliveryCharge,
        couponDiscount,
        isRetry: isRetry || false,
        retryOrderId: retryOrderId || null
    };
>>>>>>> 769d129a38449a7e280834c545fae0bde9b0978e

    // Return the total amount needed for Razorpay to the client
    res.json({ success: true, totalAmount,orderId: order._id, message: "Ready for Razorpay payment" });
}
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
    const { totalAmount, orderId } = req.body;
    const amountInPaise = Math.round(totalAmount * 100);

    let razorpayOrder;
    if (orderId) {
      // Retry: Update existing order with new Razorpay order
      razorpayOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: 'retry_' + orderId,
        payment_capture: 1
      });

      await Order.findByIdAndUpdate(orderId, { razorpayOrderId: razorpayOrder.id });
    } else {
      // Normal order
      razorpayOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: 'receipt_' + Date.now(),
        payment_capture: 1
      });
    }

    res.json({
      success: true,
      id: razorpayOrder.id,
      currency: razorpayOrder.currency,
      amount: razorpayOrder.amount
    });
  } catch (err) {
    console.error('Razorpay order creation failed:', err);
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
// helper: preserve order of productIds
async function getProductsInOrder(productIds) {
  // fetch all products at once
  const products = await Product.find({ _id: { $in: productIds } });
  // map by id for lookup
  const map = new Map(products.map(p => [p._id.toString(), p]));
  // return array in same order as productIds, skipping missing
  return productIds.map(id => map.get(id.toString())).filter(Boolean);
}
// exports.retryCheckout = async (req, res) => {
//   try {
//     if (!req.session.user) return res.redirect('/login');

//     const userId = req.session.user._id;

//     // Accept either paymentStatus OR status fields (robust)
//     const lastOrder = await Order.findOne({
//       user: userId,
//       $or: [
//         { paymentStatus: { $in: ['failed', 'pending'] } },
//         { status: { $in: ['failed', 'pending'] } }
//       ]
//     }).sort({ createdAt: -1 }).lean();

//     if (!lastOrder || !lastOrder.products || !lastOrder.products.length) {
//       return res.redirect('/cart');
//     }

//     const productIds = lastOrder.products.map(p => p.product.toString());
//     const products = await getProductsInOrder(productIds);

//     const sessionCheckout = {
//       productIds: [],
//       quantities: [],
//       offerPrices: [],
//       totalAmount: 0,
//       isFromCart: false
//     };

//     // Build sessionCheckout preserving original order and using fields that exist on order items
//     for (const item of lastOrder.products) {
//       const pid = item.product.toString();
//       const prod = products.find(p => p && p._id.toString() === pid);
//       if (!prod || prod.isBlocked || prod.isDeleted) continue;

//       const qty = item.quantity || 1;
//       // prefer unitPrice -> price -> fallback to best offer price from DB
//       const price = (item.unitPrice ?? item.price) || (await prod.getBestOfferPrice()).price;

//       sessionCheckout.productIds.push(prod._id.toString());
//       sessionCheckout.quantities.push(qty);
//       sessionCheckout.offerPrices.push(price);
//       sessionCheckout.totalAmount += qty * price;
//     }

//     // set retryOrderId so getCheckout can pick up extra data if needed
//     req.session.retryOrderId = lastOrder._id.toString();
//     req.session.checkout = sessionCheckout;
//     console.log('chekcoutilek pon')
//     return res.redirect('/user/checkout');
//   } catch (err) {
//     console.error('Retry checkout error:', err);
//     return res.status(500).redirect('/cart');
//   }
// };


exports.retryCheckoutWithOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user?._id;
    
    if (!userId) return res.redirect('/login');
    
    const order = await Order.findOne({ _id: orderId, user: userId }).lean();
    if (!order) {
      console.warn('Order not found for retry:', orderId);
      return res.redirect('/user/orders');
    }
    
    // Accept either 'paymentStatus' or 'status' fields marking failure
    const isFailed = (order.paymentStatus && order.paymentStatus === 'failed') ||
    (order.status && order.status === 'failed');
    
    if (!isFailed) {
      // allow 'pending' as retryable too
      const isPending = (order.paymentStatus && order.paymentStatus === 'pending') ||
      (order.status && order.status === 'pending');
      if (!isPending) return res.redirect('/user/orders');
    }

    const productIds = order.products.map(p => p.product.toString());
    const products = await getProductsInOrder(productIds);
    
    const sessionCheckout = {
      productIds: [],
      quantities: [],
      offerPrices: [],
      totalAmount: 0,
      isFromCart: false,
      // set the selectedAddress field to match placeOrder/getCheckout expectations
      selectedAddress: order.selectedAddress ? order.selectedAddress.toString() : null,
      couponId: order.coupon ? order.coupon.toString() : null
    };

    for (const item of order.products) {
      const pid = item.product.toString();
      const prod = products.find(p => p && p._id.toString() === pid);
      if (!prod || prod.isBlocked || prod.isDeleted) continue;
      
      const qty = item.quantity || 1;
      const price = (item.unitPrice ?? item.price) || (await prod.getBestOfferPrice()).price;
      
      sessionCheckout.productIds.push(prod._id.toString());
      sessionCheckout.quantities.push(qty);
      sessionCheckout.offerPrices.push(price);
      sessionCheckout.totalAmount += qty * price;
    }
    
    // store both checkout and retryOrderId for compatibility
    req.session.checkout = sessionCheckout;
    req.session.retryOrderId = order._id.toString();
    
    console.log('chekcoutilek povunnu')
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
    // Use pendingOrderData saved by placeOrder for online payments
    const pending = req.session.pendingOrderData;
    const user = await User.findById(req.session.user._id);

    console.log('Session pendingOrderData:', pending);
    console.log('User:', user?._id);

    if (!pending || !user) {
      console.error('❌ Session expired or pending order data missing');
      return res.json({ success: false, error: "Session expired. Please try again." });
    }

    // Verify Razorpay signature
    const crypto = require("crypto");
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.error('❌ Invalid Razorpay signature');
      return res.json({ success: false, error: "Invalid payment signature" });
    }

    console.log('✅ Payment signature verified, creating order from pending data...');

    let order;
    if (pending.isRetry && pending.retryOrderId) {
      // Update existing order for retry payment
      order = await Order.findByIdAndUpdate(pending.retryOrderId, {
        selectedAddress: pending.selectedAddress,
        products: pending.products.map(p => ({
          product: p.product,
          quantity: p.quantity,
          unitPrice: p.unitPrice
        })),
        totalAmount: pending.totalAmount,
        paymentMethod: "Online",
        deliveryCharge: pending.deliveryCharge,
        status: "Paid",
        paymentStatus: "Paid",
        couponDiscount: pending.couponDiscount,
        estimatedDelivery: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id
      }, { new: true });
    } else {
      // Create new order
      order = await Order.create({
        user: user._id,
        selectedAddress: pending.selectedAddress,
        products: pending.products.map(p => ({
          product: p.product,
          quantity: p.quantity,
          unitPrice: p.unitPrice
        })),
        totalAmount: pending.totalAmount,
        paymentMethod: "Online",
        deliveryCharge: pending.deliveryCharge,
        status: "Paid",
        paymentStatus: "Paid",
        couponDiscount: pending.couponDiscount,
        estimatedDelivery: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id
      });
    }

    console.log('✅ Order created:', order._id);

    // Do NOT decrement stock here: stock was already decremented when creating pendingOrderData in placeOrder

    // Build session.orderItems for confirmation page with product details
    const productIds = pending.products.map(p => p.product);
    const productDocs = await Product.find({ _id: { $in: productIds } });
    const orderItems = pending.products.map(p => {
      const prod = productDocs.find(d => d._id.toString() === p.product.toString());
      return {
        product: {
          _id: prod?._id || p.product,
          name: prod?.name || '',
          brand: prod?.brand || '',
          images: prod?.images || [],
          category: prod?.category || null
        },
        quantity: p.quantity,
        offerPrice: p.unitPrice
      };
    });

    // Update session for confirmation page
    req.session.orderItems = orderItems;
    req.session.address = user.addresses.id(pending.selectedAddress);
    req.session.paymentMethod = "Online";
    req.session.totalAmount = pending.totalAmount;
    req.session.deliveryCharge = pending.deliveryCharge;
    req.session.arrivalDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
    req.session.couponDiscount = pending.couponDiscount;
    req.session.orderId = order._id.toString();
    req.session.paymentVerified = true;

    // Clear pending data and retry session data
    delete req.session.pendingOrderData;
    if (pending.isRetry) {
      delete req.session.retryOrderId;
      delete req.session.checkout;
    }

    console.log('✅ Session updated, ready to redirect to confirm-payment');
 return res.json({ 
  success: true, 
  redirectUrl: '/user/confirm-payment' 
});

return res.json({ success: true, redirectUrl: "/user/confirm-payment" });

  } catch (err) {
    console.error("❌ verifyPayment Error:", err);
    return res.json({ success: false, error: "Payment verification failed" });
  }
};