exports.isAdmin = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  console.log('Admin session not found or expired, redirecting to login');
  return res.redirect('/admin/adminlog');
};
