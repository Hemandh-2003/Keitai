// authMiddleware.js
module.exports = {
  isLoggedIn: (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (!req.session.user) {
      return res.redirect('/login');
    }
    req.user = req.session.user;
    next();
  },

  preventAuthPages: (req, res, next) => {
    if (req.session.user) {
      return res.redirect('/home'); 
    }
    next();
  }
};
