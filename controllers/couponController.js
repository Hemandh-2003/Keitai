const User = require('../models/User')
const Coupon = require('../models/Coupon');
const {HTTP_STATUS}= require('../SM/status');
const { MESSAGE }= require('../SM/messages');
// Show coupons page
exports.getCoupons = async (req, res) => {
  try {
    const perPage = 5;
    const page = parseInt(req.query.page) || 1;

    const totalCoupons = await Coupon.countDocuments();
    const totalPages = Math.ceil(totalCoupons / perPage);

    const coupons = await Coupon.find()
      .sort({ endDate: 1})
      .skip((page - 1) * perPage)
      .limit(perPage);

      res.render('admin/coupons',{
        coupons,
        currentPage: page,
        totalPages,
        messages: req.flash()
      });
  } catch (err) {
    console.error('Error Fetching coupons:',err);
    res.redirect('/admin/dashboard');
  }
};

// Create coupon
exports.createCoupon = async (req, res) => {
  try {
    const { code, discountType, discount, minPurchase, maxDiscount, startDate, endDate } = req.body;

    const trimmedCode = code.trim().toUpperCase();

    const perPage = 5;
    const page = parseInt(req.query.page) || 1;
    const totalCoupons = await Coupon.countDocuments();
    const totalPages = Math.ceil(totalCoupons / perPage);

    const coupons = await Coupon.find()
      .sort({ endDate: 1 })
      .skip((page - 1) * perPage)
      .limit(perPage);

    const existingCoupon = await Coupon.findOne({ code: trimmedCode });
    if (existingCoupon) {
      return res.render('admin/coupons', {
        coupons,
        messages: { error: 'Coupon code already exists.' },
        totalPages,
        currentPage: page
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return res.render('admin/coupons', {
        coupons,
        messages: { error: 'Start date must be before end date.' },
        totalPages,
        currentPage: page
      });
    }

    const parsedDiscount = parseFloat(discount);
    const parsedMinPurchase = parseFloat(minPurchase) || 0;
    const parsedMaxDiscount = parseFloat(maxDiscount) || 0;

    if (discountType === 'percentage') {
      if (parsedDiscount < 1 || parsedDiscount > 90) {
        return res.render('admin/coupons', {
          coupons,
          messages: { error: 'Percentage discount must be between 1% and 90%.' },
          totalPages,
          currentPage: page
        });
      }
    } else if (discountType === 'fixed') {
      if (parsedDiscount < 2000 || parsedDiscount > 50000) {
        return res.render('admin/coupons', {
          coupons,
          messages: { error: 'Fixed discount must be between ₹2000 and ₹50,000.' },
          totalPages,
          currentPage: page
        });
      }
    }

    if (discountType === 'fixed' || discountType === 'percentage') {
    if (parsedMinPurchase < 2000) {
      return res.render('admin/coupons', {
        coupons,
        messages: { error: 'Minimum purchase amount must be at least ₹2000.' },
        totalPages,
        currentPage: page
      });
    }
  }
  if (discountType === 'percentage') {
    if (parsedMaxDiscount < 2500) {
      return res.render('admin/coupons', {
        coupons,
        messages: { error: 'Maximum discount amount must be at least ₹2500.' },
        totalPages,
        currentPage: page
      });
    }
  }

    const newCoupon = new Coupon({
      code: trimmedCode,
      discountType,
      discount: parsedDiscount,
      minPurchase: parsedMinPurchase,
      maxDiscount: parsedMaxDiscount,
      startDate: start,
      endDate: end
    });

    await newCoupon.save();

    req.flash('success', 'Coupon added successfully!');
    return res.redirect('/admin/coupons');
  } catch (err) {
    console.error('Error creating coupon:', err.message);
    req.flash('error', 'Failed to create coupon. Please try again.');
    return res.redirect('/admin/coupons');
  }
};

// Edit coupon
exports.editCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, discountType, discount, minPurchase, maxDiscount, startDate, endDate } = req.body;

    const trimmedCode = code.trim().toUpperCase();


    const existingCoupon = await Coupon.findOne({ code: trimmedCode, _id: { $ne: id } });
    if (existingCoupon) {
      req.flash('error', 'Coupon code already exists.');
      return res.redirect('/admin/coupons');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      req.flash('error', 'Start date must be before end date.');
      return res.redirect('/admin/coupons');
    }

    const parsedDiscount = parseFloat(discount);
    const parsedMinPurchase = parseFloat(minPurchase) || 0;
    const parsedMaxDiscount = parseFloat(maxDiscount) || 0;

    if (discountType === 'percentage') {
      if (parsedDiscount < 1 || parsedDiscount > 90) {
        req.flash('error', 'Percentage discount must be between 1% and 90%.');
        return res.redirect('/admin/coupons');
      }
      if (parsedMaxDiscount < 2500) {
        req.flash('error', 'Maximum discount must be at least ₹2500.');
        return res.redirect('/admin/coupons');
      }
    } else if (discountType === 'fixed') {
      if (parsedDiscount < 2000 || parsedDiscount > 50000) {
        req.flash('error', 'Fixed discount must be between ₹2000 and ₹50,000.');
        return res.redirect('/admin/coupons');
      }
    }

    if (parsedMinPurchase < 2000) {
      req.flash('error', 'Minimum purchase must be at least ₹2000.');
      return res.redirect('/admin/coupons');
    }

    await Coupon.findByIdAndUpdate(id, {
      code: trimmedCode,
      discountType,
      discount: parsedDiscount,
      minPurchase: parsedMinPurchase,
      maxDiscount: parsedMaxDiscount,
      startDate: start,
      endDate: end
    });

    req.flash('success', 'Coupon updated successfully!');
    res.redirect('/admin/coupons');
  } catch (err) {
    console.error('Error editing coupon:', err);
    req.flash('error', 'Failed to update coupon. Please try again.');
    res.redirect('/admin/coupons');
  }
};

// Delete coupon
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    await Coupon.findByIdAndDelete(id);
    req.flash('success', 'Coupon deleted');
    res.redirect('/admin/coupons');
  } catch (err) {
    console.error('Error deleting coupon:', err);
    req.flash('error', 'Failed to delete coupon.');
    res.redirect('/admin/coupons');
  }
};

exports.applyCoupon = async (req, res) => {
  const { code, total } = req.body;

  try {
    if (!req.session.user) {
      return res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json({ success: false, message: 'Please login to apply coupon' });
    }

    const formattedCode = code.trim().toUpperCase();
    const userId = req.session.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: 'User not found' });
    }

    if (!(user.couponUsage instanceof Map)) {
      user.couponUsage = new Map(Object.entries(user.couponUsage || {}));
    }

    const coupon = await Coupon.findOne({ code: formattedCode, isActive: true });
    if (!coupon) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: 'Invalid coupon code' });
    }

    const now = new Date();
    if (coupon.startDate > now || coupon.endDate < now) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: 'Coupon is not valid at this time' });
    }

    // ✅ Check usage limit (max 2 times per user)
    const usedCount = user.couponUsage.get(formattedCode) || 0;
    if (usedCount >= 2) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `You have already used coupon ${formattedCode} 2 times.`,
      });
    }

    if (total < coupon.minPurchase) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `Minimum order value for this coupon is ₹${coupon.minPurchase}.`,
      });
    }

    // ✅ Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = Math.round((total * coupon.discount) / 100);
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else if (coupon.discountType === 'fixed') {
      discountAmount = Math.min(coupon.discount, total);
    }

    // ✅ Save coupon info in session
    req.session.coupon = {
      code: coupon.code,
      discount: coupon.discount,
      discountType: coupon.discountType,
      discountAmount,
    };

    // ✅ Increment usage count & save
    user.couponUsage.set(formattedCode, usedCount + 1);
    await user.save();

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      discountAmount,
      finalAmount: total - discountAmount,
      code: coupon.code,
      message: `Coupon applied successfully! (${usedCount + 1}/2 uses)`,
    });
  } catch (err) {
    console.error('❌ Coupon error:', err);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: 'Server error' });
  }
};

exports.removeCoupon = (req, res) => {
  req.session.coupon = null;
  res.json({ success: true });
};

