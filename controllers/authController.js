const bcrypt = require('bcrypt');
const User = require('../models/User');
const otpController = require('./otpController');

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
exports.loadLogin = (req, res) => {

  res.render('user/login', { error: null });
};

// Handle login form submission
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.render('user/login', { error: 'User does not exist. Please sign up.' });
    }

    // Check if the user is blocked
    if (user.isBlocked) {
      return res.render('user/login', { error: 'Your account is blocked. Please contact support.' });
    }

    // Verify the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render('user/login', { error: 'Invalid credentials. Please try again.' });
    }

    // Store user session and redirect to home
    req.session.user = user;  // Save the entire user object in session
    res.redirect('/home');  // Redirect to the user home page
    console.log('Session after login:', req.session);
  } catch (error) {
    console.error('Login Error:', error);
    res.render('user/login', { error: 'Something went wrong. Please try again later.' });
  }
};
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.render('user/login', { error: 'User does not exist. Please sign up.' });
    }

    // Check if the user is blocked
    if (user.isBlocked) {
      return res.render('user/login', { error: 'Your account is blocked. Please contact support.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render('user/login', { error: 'Invalid credentials. Please try again.' });
    }

    req.session.user = user; // Store user in session
    res.redirect('/home'); // Proceed to the home page or wherever after login
  } catch (error) {
    console.error('Login Error:', error);
    res.render('user/login', { error: 'Something went wrong. Please try again later.' });
  }
};

// Verify OTP
exports.verifyOtp = (req, res) => {
  const { email, otp } = req.body; // Ensure JSON body
  console.log(`Verifying OTP for email: ${email}, OTP: ${otp}`); // Debugging

  if (otpController.validateOtp(email, otp)) {
    return res.json({ success: true });
  }

  res.json({ success: false, error: 'Invalid OTP. Please try again.' });
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login'); // Redirect to login page after logging out
  });
};