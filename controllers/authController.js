const bcrypt = require('bcrypt');
const User = require('../models/User');
const otpController = require('./otpController');
const generateUniqueUserCode = require('../utils/userCode');

exports.loadLandingPage = (req, res) => {
  res.render('user/index', {
    title: 'Welcome to Keitai',
    user: req.session.user || null 
  });
};


exports.loadLogin = (req, res) => {
  res.render('user/login', { error: null });
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, confirm, referralCode } = req.body;

    //console.log('Register called with:', { name, email, referralCode });

    if (!name || !email || !password || !confirm) {
     // console.log('Validation failed: missing fields');
      return res.render('user/signup', { error: 'All fields are required.' });
    }
    
    const nameRegex = /^[A-Za-z0-9]+$/;
    if(!nameRegex.test(name)) {
      return res.render('user/signup', {error: 'Name can only contain letter and Numbers'})
    }

    if (password !== confirm) {
     // console.log('Validation failed: passwords do not match');
      return res.render('user/signup', { error: 'Passwords do not match.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('user/signup', { error: 'Email already in use.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    //console.log('Password hashed successfully');

    const userCode = await generateUniqueUserCode();
    //console.log('Unique user code generated:', userCode);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      userCode: userCode.toString(),
      wallet: { balance: 0, transactions: [] },
    });
    //console.log('New user object created');
    const code = referralCode ? referralCode.trim() : null;
if (code) {
  const referrer = await User.findOne({ referralCode: code }); 
  if (referrer) {
   // console.log('Referrer found:', referrer.email);
    user.referredBy = code;

    user.wallet.balance += 500;
    user.wallet.transactions.push({
      type: 'Credit',
      amount: 500,
      reason: 'Referral Bonus for joining with a code',
      date: new Date(),
    });
   // console.log('New user rewarded with 500');

    referrer.wallet.balance += 1000;
    referrer.wallet.transactions.push({
      type: 'Credit',
      amount: 1000,
      reason: `Referral Bonus for referring ${name}`,
      date: new Date(),
    });
    referrer.referralRewards = (referrer.referralRewards || 0) + 1000;
    //console.log('Referrer rewarded with 1000');

    // Save both users
    await referrer.save();
   // console.log('Referrer saved successfully');

    await user.save();
   // console.log('New user saved successfully');
  } else {
    console.warn('Invalid referral code, skipping rewards.');
    await user.save();
   // console.log('New user saved without referral rewards');
  }
} else {
  await user.save();
  //console.log('New user saved without referral code');
}

    const otp = otpController.generateOtp(email);
    const otpSent = await otpController.sendOtpEmail(email, otp);
   // console.log('OTP sent status:', otpSent);

    if (!otpSent) {
     // console.log('Error sending OTP');
      return res.render('user/signup', { error: 'Error sending OTP. Try again.' });
    }

    //console.log('Redirecting to OTP page');
    res.redirect(`/otp?email=${email}`);
  } catch (error) {
    console.error('Registration Error:', error);
    res.render('user/signup', { error: 'Registration failed. Please try again.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.render('user/login', { error: 'User does not exist. Please sign up.' });
    }

    if (user.isBlocked) {
      return res.render('user/login', { error: 'Your account is blocked. Please contact support.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render('user/login', { error: 'Invalid credentials. Please try again.' });
    }

    req.session.user = user;
    res.redirect('/home');
  } catch (error) {
    console.error('Login Error:', error);
    res.render('user/login', { error: 'Something went wrong. Please try again later.' });
  }
};

exports.verifyOtp = (req, res) => {
  const { email, otp } = req.body;

  if (otpController.validateOtp(email, otp)) {
    return res.json({ success: true });
  }

  res.json({ success: false, error: 'Invalid OTP. Please try again.' });
};

exports.resendOtp = async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).send('Email is required');
  }

  try {
    const otp = otpController.generateOtp(email);
    const otpSent = await otpController.sendOtpEmail(email, otp);

    if (otpSent) {
      return res.status(200).send('OTP resent successfully');
    } else {
      return res.status(500).send('Error resending OTP');
    }
  } catch (err) {
    console.error('Error resending OTP:', err);
    return res.status(500).send('Error resending OTP');
  }
};

exports.logout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.redirect('/');
    }
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
};

exports.sessionStatus = (req, res) => {
  res.json({ isLoggedIn: !!req.session.user });
};
