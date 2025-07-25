// controllers/couponController.js
const Coupon = require('../models/Coupon');

exports.applyCoupon = async (req, res) => {
  const { code, total } = req.body;

  try {
    const formattedCode = code.toUpperCase();

    if (req.session.coupon && req.session.coupon.code === formattedCode) {
      return res.status(400).json({ success: false, message: 'Coupon already applied' });
    }

    // ✅ Block if total < 5,00,000
if (total < 200000) {
  return res.status(400).json({
    success: false,
    message: 'Minimum order value for applying coupon is ₹2,00,000'
  });
}

    const coupon = await Coupon.findOne({ code: formattedCode, isActive: true });

    if (!coupon) {
      return res.status(400).json({ success: false, message: 'Invalid coupon code' });
    }

    const now = new Date();
    if (coupon.startDate > now || coupon.endDate < now) {
      return res.status(400).json({ success: false, message: 'Coupon is not valid at this time' });
    }

    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = Math.round((total * coupon.discount) / 100);
    } else if (coupon.discountType === 'fixed') {
      discountAmount = Math.min(coupon.discount, total);
    }

    req.session.coupon = {
      code: coupon.code,
      discount: coupon.discount,
      discountType: coupon.discountType,
      discountAmount
    };

    console.log(`✅ Coupon applied: ${coupon.code} | Discount: ₹${discountAmount}`);

    return res.status(200).json({
      success: true,
      discountAmount,
      finalAmount: total - discountAmount,
      code: coupon.code
    });

  } catch (err) {
    console.error('❌ Coupon error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.removeCoupon = (req, res) => {
  req.session.coupon = null;
  res.json({ success: true });
};

