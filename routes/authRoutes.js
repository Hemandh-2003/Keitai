const express = require('express');
const { register, verifyOtp } = require('../controllers/authController');
const otpController = require('../controllers/otpController'); // Import otpController for resend functionality
const passport = require('../config/passport')
const router = express.Router();
const authController = require('../controllers/authController')
const Product = require('../models/Product');
const debug = require('debug')('app:auth');
router.get('/login',authController.loadLogin)


router.post('/login',authController.login)



router.get('/', (req, res) => {
  res.render('user/index', { title: 'Welcome to Keitai' });
});
router.get('/signup', (req, res) => {
  res.render('user/signup', { error: null });
});

router.post('/register', register);

router.get('/otp', (req, res) => {
  const { email } = req.query;
  res.render('user/otp', { email, error: null });
});

router.post('/verify-otp', verifyOtp);

router.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account', // Add this option to always prompt for account selection
  })
);
router.get('/login', (req, res) => {
  if (req.user) {
    return res.redirect('/home'); // Redirect to home if already logged in
  }
  res.render('user/login');
});


router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // console.log('/auth/google/callback');
    // console.log('Authenticated user:', req.user);

    // Optional: Save the user to session manually (already done by Passport, but can be custom)
    req.session.user = req.user;

    // Optional: Block login if user is blocked
    if (req.user.isBlocked) {
      req.logout(err => {
        if (err) console.error('Logout error:', err);
        return res.redirect('/blocked');
      });
    } else {
      res.redirect('/home');
    }
  }
);

// Resend OTP route
router.get('/resend-otp', async (req, res) => {
  const { email } = req.query; // Extract email from query parameters
  console.log(`Resending OTP for email: ${email}`); // Debugging log

  if (!email) {
      return res.status(400).send('Email is required'); // Error if email is missing
  }

  try {
      const otp = otpController.generateOtp(email); // Generate a new OTP
      const otpSent = await otpController.sendOtpEmail(email, otp); // Send the OTP via email

      if (otpSent) {
          console.log(`Resent OTP for ${email}: ${otp}`);
          return res.status(200).send('OTP resent successfully'); // Success response
      } else {
          return res.status(500).send('Error resending OTP'); // Failure response
      }
  } catch (err) {
      console.error('Error resending OTP:', err); // Log any error
      return res.status(500).send('Error resending OTP'); // Failure response
  }
});
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.redirect('/'); // Redirect to home if session destruction fails
    }
    res.clearCookie('connect.sid'); // Clear session cookie
    res.redirect('/login'); // Redirect to login page
  });
});
router.get('/status', (req, res) => {
  if (req.session.user) {
    return res.json({ isLoggedIn: true });
  }
  res.json({ isLoggedIn: false });
});
module.exports = router;
