const mongoose = require('mongoose');
const User = require('./User'); // adjust the path if needed
const generateUniqueUserCode = require('../utils/userCode');


mongoose.connect('mongodb://localhost:27017/keitai_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function generateUserCodes() {
  const users = await User.find({ userCode: { $exists: false } });
  for (let user of users) {
    user.userCode = await generateUniqueUserCode();
    await user.save();
    console.log(`Updated user ${user.name} with code ${user.userCode}`);
  }
  console.log('All users updated');
  mongoose.disconnect();
}

generateUserCodes();
