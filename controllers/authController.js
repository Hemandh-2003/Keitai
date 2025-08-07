const bcrypt = require('bcrypt');
const User = require('../models/User');
const otpController = require('./otpController');

// Load landing page
exports.loadLandingPage = (req, res) => {
  res.render('user/index', {
    title: 'Welcome to Keitai',
    user: req.session.user || null  // 🔑 Fix: Pass user to view
  });
};


// Load login page
exports.loadLogin = (req, res) => {
if (req.session.user || req.user) {
  req.session.user = user; 
  req.session.loginSuccess = true;
  return res.redirect('/home');
}
  res.render('user/login', { error: null });
};



// Register user
exports.register = async (req, res) => {
  try {
    const { name, email, password, confirm } = req.body;

    if (!name || !email || !password || !confirm) {
      return res.render('user/signup', { error: 'All fields are required.' });
    }

    if (password !== confirm) {
      return res.render('user/signup', { error: 'Passwords do not match.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('user/signup', { error: 'Email already in use.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();

    const otp = otpController.generateOtp(email);
    const otpSent = await otpController.sendOtpEmail(email, otp);

    if (!otpSent) {
      return res.render('user/signup', { error: 'Error sending OTP. Try again.' });
    }

    res.redirect(`/otp?email=${email}`);
  } catch (error) {
    console.error('Registration Error:', error);
    res.render('user/signup', { error: 'Registration failed. Please try again.' });
  }
};

// Login user
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

// Verify OTP
exports.verifyOtp = (req, res) => {
  const { email, otp } = req.body;

  if (otpController.validateOtp(email, otp)) {
    return res.json({ success: true });
  }

  res.json({ success: false, error: 'Invalid OTP. Please try again.' });
};

// Resend OTP
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

// Logout user
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

// Session status
exports.sessionStatus = (req, res) => {
  res.json({ isLoggedIn: !!req.session.user });
};
