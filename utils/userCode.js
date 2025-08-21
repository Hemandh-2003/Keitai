const User = require('../models/User');

async function generateUniqueUserCode() {
  let code;
  let exists = true;

  while (exists) {
    code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    exists = await User.findOne({ userCode: code });
  }

  return code;
}

module.exports = generateUniqueUserCode;
