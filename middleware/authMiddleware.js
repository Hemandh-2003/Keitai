// authMiddleware.js
module.exports = {
  isLoggedIn: (req, res, next) => {
    console.log('Session Data:', req.session);
    console.log('Checking user login status...');
    if (!req.session.user) {
      console.log('User not logged in, redirecting to /login');
      return res.redirect('/login');
    }
    console.log('User authenticated');
    req.user = req.session.user; // Attach user to req object
    next();
  },
};