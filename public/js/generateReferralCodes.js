const mongoose = require('mongoose');
const User = require('../models/User'); // adjust path

mongoose.connect('mongodb://127.0.0.1:27017/keitai_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
async function generateUniqueReferralCode() {
  let code;
  let exists;
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
    exists = await User.findOne({ referralCode: code });
  } while (exists);
  return code;
}

(async () => {
  try {
    const users = await User.find({
      $or: [{ referralCode: null }, { referralCode: { $exists: false } }]
    });

    for (const user of users) {
      user.referralCode = await generateUniqueReferralCode();
      await user.save();
    }

    console.log("Referral codes generated for existing users ✅");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
