// authMiddleware.js
module.exports = {
  isLoggedIn: (req, res, next) => {
    console.log('Checking user login status...');
    if (!req.session.user) {
      console.log('User not logged in, redirecting to /login');
      return res.redirect('/login');
    }
    console.log('User authenticated');
    next();
  },
};
