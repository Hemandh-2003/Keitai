const User = require('../models/User'); // Import the User model

module.exports = async (req, res, next) => {
  if (req.session && req.session.user) {
    // Debugging: Check if user session exists
    //console.log('Session User:', req.session.user);

    try {
      // Fetch the latest user data from the database
      const user = await User.findById(req.session.user._id);

      // If the user is not found, destroy the session and redirect to login
      if (!user) {
        req.session.destroy((err) => {
          if (err) {
            console.error('Error destroying session:', err);
          }
        });
        return res.redirect('/login');
      }

      // Update the session with the latest user data
      req.session.user = user;

      // Check if the user is blocked
      if (user.isBlocked) {
        //console.log('User is blocked. Destroying session and redirecting to login...');
        // Destroy the session if the user is blocked
        req.session.destroy((err) => {
          if (err) {
            console.error('Error destroying session:', err);
          }
        });
        return res.redirect('/login'); // Redirect to login if blocked
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      return res.status(500).send('Server error');
    }
  }

  next(); // Continue to the next middleware or route
};
