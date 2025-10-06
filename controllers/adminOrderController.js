const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { HTTP_STATUS }= require('../SM/status');
exports.listOrders = async (req, res) => {
  try {
    const sort = req.query.sort || 'new';
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    let sortCriteria = {};
    let filterCriteria = {};

    switch (sort) {
      case 'new':
        sortCriteria = { createdAt: -1 };
        break;
      case 'old':
        sortCriteria = { createdAt: 1 };
        break;
      case 'cancelled':
        filterCriteria = { status: 'Cancelled' };
        sortCriteria = { createdAt: -1 };
        break;
      case 'user-cancelled':
        filterCriteria = { status: 'User Cancelled' };
        sortCriteria = { createdAt: -1 };
        break;
      case 'shipped':
        filterCriteria = { status: 'Shipped' };
        sortCriteria = { createdAt: -1 };
        break;
      case 'delivered':
        filterCriteria = { status: 'Delivered' };
        sortCriteria = { createdAt: -1 };
        break;
      case 'pending':
        filterCriteria = { status: 'Pending' };
        sortCriteria = { createdAt: -1 };
        break;
      case 'return-requested':
        filterCriteria = { returnRequested: true, returnStatus: 'Requested' };
        sortCriteria = { createdAt: -1 };
        break;
      default:
        sortCriteria = { createdAt: -1 };
    }

    const orders = await Order.find(filterCriteria)
      .sort(sortCriteria)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user')
      .populate('products.product')
      .exec();

    const totalOrders = await Order.countDocuments(filterCriteria);
    const totalPages = Math.ceil(totalOrders / limit);

    res.render('admin/orders', {
      orders,
      sort,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error('Error listing orders:', error.message);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Error retrieving orders');
  }
};


// Change Order Status
exports.changeOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await Order.findOneAndUpdate(
      { orderId: orderId },
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Order not found' });
    }

    res.redirect('/admin/orders');
  } catch (error) {
    console.error('Error changing order status:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Error changing order status');
  }
};

exports.updateReturnStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { action } = req.body;

    if (!['Approved', 'Rejected'].includes(action)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).send('Invalid action');
    }

    const order = await Order.findById(orderId).populate('user');
//console.log('Order:', order);

if (!order || order.returnStatus !== 'Requested') {
  return res.status(HTTP_STATUS.BAD_REQUEST).send('Invalid return request');
}

order.returnStatus = action;
order.returnRequested = false;
order.statusHistory.push({
  status: `Return ${action}`,
  updatedAt: new Date(),
});

 if (action === 'Approved') {
      const user = order.user;
      let totalRefund = 0;
      
      for (const returnedItem of order.returnedItems) {
        if (returnedItem.status !== 'Pending') continue;

        const orderedProduct = order.products.find(p => 
          p.product && p.product._id.toString() === returnedItem.product._id.toString()
        );

        if (orderedProduct) {
          const price = returnedItem.refundAmount / returnedItem.quantity || 
                       orderedProduct.unitPrice || 
                       orderedProduct.price || 
                       orderedProduct.product?.salesPrice || 
                       orderedProduct.product?.regularPrice || 
                       0;

          const itemRefund = price * returnedItem.quantity;
          totalRefund += itemRefund;

          returnedItem.status = 'Approved';
        }
      }

    if (totalRefund > 0) {
  await User.findByIdAndUpdate(user._id, {
    $inc: { 'wallet.balance': totalRefund },
    $push: {
      'wallet.transactions': {
        type: 'Credit',
        amount: totalRefund,
        reason: `Refund for returned items from order #${order.orderId}`,
        orderId: order._id,
        date: new Date()
      }
    }
  });
}

    }

    await order.save();

    res.redirect('/admin/orders?sort=return-requested');
  } catch (error) {
    console.error('Error updating return status:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Server error');
  }
};



// Cancel Order
exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId }).populate('products.product').exec();
    if (!order) return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Order not found' });
    order.status = 'Cancelled';
    await order.save();

    const bulkOps = order.products.map(item => ({
      updateOne: {
        filter: { _id: item.product._id },
        update: { $inc: { quantity: item.quantity } }
      }
    }));
    if (bulkOps.length > 0) await Product.bulkWrite(bulkOps);

    const user = await User.findById(order.user);
    const refundAmount = order.totalAmount;

    user.wallet.balance += refundAmount;
    user.wallet.transactions.push({
      type: 'Credit',
      amount: refundAmount,
      reason: 'Order Cancelled',
      orderId: order._id,
    });
    await user.save();

    res.redirect('/admin/orders');
  } catch (error) {
    console.error('Error canceling order:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Server error');
  }
};
exports.adminCancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findOne({ orderId }).populate('products.product');
    
    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).send('Order not found');
    }

    order.status = 'Cancelled';
    order.cancellationReason = reason || 'Admin cancellation';
    await order.save();

    await Promise.all(order.products.map(async item => {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { stock: item.quantity }
      });
    }));

    res.redirect(`/admin/orders/${order.orderId}`);
  } catch (err) {
    console.error(err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Cancellation failed');
  }
};
