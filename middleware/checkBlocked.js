const User = require('../models/User'); 

module.exports = async (req, res, next) => {
  if (req.session && req.session.user) {
    //console.log('Session User:', req.session.user);

    try {
      const user = await User.findById(req.session.user._id);

      if (!user) {
        req.session.destroy((err) => {
          if (err) {
            console.error('Error destroying session:', err);
          }
        });
        return res.redirect('/login');
      }

      req.session.user = user;

      if (user.isBlocked) {
        //console.log('User is blocked. Destroying session and redirecting to login...');
        req.session.destroy((err) => {
          if (err) {
            console.error('Error destroying session:', err);
          }
        });
        return res.redirect('/login'); 
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      return res.status(500).send('Server error');
    }
  }

  next(); // Continue to the next middleware or route
};
