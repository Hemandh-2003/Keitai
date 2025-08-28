exports.isAdmin = (req, res, next) => {
  if (req.session.isAdmin) {
    //console.log('Admin authenticated successfully'); // Optional: Debug log
    return next(); // Proceed if admin session exists
  }
  console.log('Admin session not found, redirecting to login');
  res.redirect('/admin/adminlog'); // Redirect to admin login page
};  