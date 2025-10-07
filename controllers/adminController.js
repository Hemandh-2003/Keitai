const razorpay = require('../config/razorpay');
const User = require('../models/User');
const Review = require('../models/review'); 
const Category = require('../models/Category');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Offer = require('../models/Offer');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const Coupon = require('../models/Coupon');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { HTTP_STATUS }= require('../SM/status');
const { MESSAGE } = require('../SM/messages');
exports.adminDashboard = (req, res) => {
  res.render('admin/dashboard');
};
//Admin
exports.getDashboardStats = async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;

    let match = { status: { $ne: 'Cancelled' } };

    if (range === 'daily') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      match.createdAt = { $gte: today, $lt: tomorrow };
    } else if (range === 'monthly') {
      const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
      match.createdAt = { $gte: firstDay, $lt: lastDay };
    } else if (range === 'yearly') {
      const year = new Date().getFullYear();
      const start = new Date(year, 0, 1);
      const end = new Date(year + 1, 0, 1);
      match.createdAt = { $gte: start, $lt: end };
    } else if (startDate && endDate) {
      match.createdAt = { $gte: new Date(startDate), $lt: new Date(endDate) };
    }

    const orders = await Order.find(match).populate('products.product');
    const sales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const orderCount = orders.length;

   
    const topProducts = await Order.aggregate([
      { $match: match },
      { $unwind: '$products' },
      {
        $group: {
          _id: '$products.product',
          totalSold: { $sum: '$products.quantity' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          name: '$product.name',
          totalSold: 1
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);

  
    const topCategories = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $project: {
          name: '$category.name',
          count: 1
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      sales,
      orderCount,
      topProducts,
      topCategories,
      message: 'Dashboard stats fetched successfully'
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: MESSAGE.SERVER_ERROR });
  }
};

exports.viewProductDetails = async (req, res) => {
  try {
    // console.log('viewProductDetail')

      const product = await Product.findById(req.params.id).populate('category');
      if (!product) {
          return res.status(HTTP_STATUS.NOT_FOUND).send(MESSAGE.PRODUCT_NOT_FOUND);
      }
      res.render('user/Product-details', { product });
  } catch (error) {
      console.error(error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(MESSAGE.ERROR);
  }
};



// Payment Integration with Razorpay
exports.initiatePayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId });

    if (!order || isNaN(order.totalAmount)) {
      console.error('❌ Invalid order or total amount:', order?.totalAmount);
      return res.status(HTTP_STATUS.BAD_REQUEST).send(MESSAGE.INVALID_ORDER);
    }

    const amountInPaise = Math.round(parseFloat(order.totalAmount) * 100);

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: order.orderId,
    };

   // console.log("📦 Razorpay Options:", options);

    const razorpayOrder = await razorpay.orders.create(options);
    

    order.paymentMethod = 'Online';
    order.razorpayOrderId = razorpayOrder.id;
    order.amount=razorpayOrder.amount;
    await order.save();
    //console.log(razorpayOrder)

    res.json({
      id: razorpayOrder.id,
      currency: razorpayOrder.currency,
      amount: razorpayOrder.amount,
      order_id: order.orderId
    });

  } catch (err) {
    console.error('❌ Razorpay creation failed:', err.message || err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(MESSAGE.PAYMENT_ERROR);
  }
};


exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });

    if (!order) {
      return res.status(HTTP_STATUS.BAD_REQUEST).send(MESSAGE.INVALID_ORDER_ID);
    }

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(HTTP_STATUS.BAD_REQUEST).send(MESSAGE.PAYMENT_VERIFICATION_FAILED);
    }

    order.paymentStatus = MESSAGE.PAYMENT_STATUS;
    order.razorpayPaymentId = razorpay_payment_id;
    order.status = MESSAGE.ORDER_STATUS1; 
    await order.save();

    res.redirect(`/payment/success/${order.orderId}`);
  } catch (err) {
    console.error(err);
    res.redirect('/payment/failed');
  }
};

exports.viewOrderDetails = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId })
      .populate('user')
      .populate('products.product')
      .populate('selectedAddress');

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).send(MESSAGE.ORDER_NOT_FOUND);
    }

    res.render('admin/order-details', { 
      order,
      isAdmin: true 
    });
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(MESSAGE.ERROR_LOADING_ORDER_DETAILS);
  }
};

exports.processUserCancellation = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findOne({ orderId }).populate('products.product');
    
    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).send(MESSAGE.ORDER_NOT_FOUND);
    }

    if (!['Pending', 'Shipped'].includes(order.status)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).send(MESSAGE.CANNOT_CANCEL);
    }

    order.status = MESSAGE.ORDER_STATUS2;
    order.cancellationReason = reason || 'No reason provided';
    await order.save();

    await Promise.all(order.products.map(async item => {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { stock: item.quantity }
      });
    }));

    if (req.user.role === 'admin') {
      res.redirect(`/admin/orders/${order.orderId}`);
    } else {
      res.redirect(`/orders/${order.orderId}`);
    }
  } catch (err) {
    console.error(err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(MESSAGE.CANCELLATION_FAILED);
  }
};

exports.processReturnRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(HTTP_STATUS.BAD_REQUEST).send(MESSAGE.RETURN_REASON);
    }

    const order = await Order.findOne({ orderId });
    
    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).send(MESSAGE.ORDER_NOT_FOUND);
    }

    if (order.status !== MESSAGE.ORDER_STATUS3) {
      return res.status(HTTP_STATUS.BAD_REQUEST).send(MESSAGE.ONLY_DELIVERED_ORDER_CAN_BE_RETURNED);
    }

    order.status = MESSAGE.ORDER_STATUS4;
    order.returnReason = reason;
    order.returnRequestDate = new Date();
    await order.save();

    if (req.user.role === 'admin') {
      res.redirect(`/admin/orders/${order.orderId}`);
    } else {
      res.redirect(`/orders/${order.orderId}`);
    }
  } catch (err) {
    console.error(err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(MESSAGE.RETURN_REQUEST_FAILED);
  }
};

module.exports = exports;

exports.listAllPayments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const { paymentMethod, startDate, endDate } = req.query;

    let filter = {};

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const orders = await Order.find(filter)
      .populate("user")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalOrders = await Order.countDocuments(filter);

    res.render("admin/payments", {
      orders,
      totalPages: Math.ceil(totalOrders / limit),
      currentPage: page,
      paymentMethod: paymentMethod || '',
      startDate: startDate || '',
      endDate: endDate || ''
    });
  } catch (err) {
    console.error("Error fetching payments:", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("admin/500", { message: MESSAGE.INTERNAL_SERVER_ERROR });
  }
};

exports.viewPaymentDetails = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId)
      .populate("user")
      .populate("products.product");

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).render("admin/404", { message: MESSAGE.ORDER_NOT_FOUND });
    }

    res.render("admin/payment", { order }); 
  } catch (err) {
    console.error("Error fetching payment details:", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("admin/500", { message: MESSAGE.INTERNAL_SERVER_ERROR });
  }
};
