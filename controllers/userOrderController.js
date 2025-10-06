const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const {HTTP_STATUS}= require('../SM/status');

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
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('error', { 
      message: 'Error loading orders',
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  }
};

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
      return res.status(HTTP_STATUS.NOT_FOUND).send('Order not found');
    }

    const selectedAddress = order.user.addresses.find(
      (address) =>
        order.selectedAddress &&
        address._id.toString() === order.selectedAddress.toString()
    );

    if (!selectedAddress) {
      return res.status(HTTP_STATUS.NOT_FOUND).send('Selected address not found');
    }

    res.render('user/orderDetails', {
      order,
      selectedAddress,
    });

  } catch (err) {
    console.error('Error fetching order details:', err.stack || err);
    res.status(HTTP_STATUS. INTERNAL_SERVER_ERROR).send('Server error');
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
    console.error("❌ Error canceling order:", err);
    req.flash("error", "Failed to cancel order");
    return res.redirect("/user/orders");
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

//Bill
exports.downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).send('Invalid order ID');
    }

    const order = await Order.findById(orderId)
      .populate('products.product')
      .populate('coupon')
      .populate('user');

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).send('Order not found');
    }

    const selectedAddress = order.user.addresses.find(
      (addr) => addr._id.toString() === order.selectedAddress.toString()
    );

    if (!selectedAddress) {
      return res.status(HTTP_STATUS.NOT_FOUND).send('Address not found');
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
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Could not generate invoice');
  }
};