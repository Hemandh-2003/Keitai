const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const authController = require('../controllers/authController');
const { isLoggedIn, preventAuthPages } = require('../middleware/authMiddleware');
// Root page
router.get('/', authController.loadLandingPage);

// Auth pages
router.get('/signup', preventAuthPages,(req, res) => res.render('user/signup', { error: null }));
router.get('/login', preventAuthPages,authController.loadLogin);
router.get('/otp', (req, res) => {
  const { email } = req.query;
  res.render('user/otp', { email, error: null });
});

// Auth actions
router.post('/register',preventAuthPages, authController.register);
router.post('/login', preventAuthPages,authController.login);
router.post('/verify-otp', authController.verifyOtp);
router.get('/resend-otp', authController.resendOtp);
router.get('/logout', authController.logout);
router.get('/status', authController.sessionStatus);

// Google OAuth
router.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })
);

router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    req.session.user = req.user;

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

module.exports = router;
