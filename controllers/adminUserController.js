const User = require('../models/User');
const { HTTP_STATUS }= require('../SM/status');
// User management
// User management
exports.listUsers = async (req, res) => {
  try {
    const sortBy = req.query.sort || 'all';
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    let filter = {};
    let sort = { createdAt: -1 };

    switch (sortBy) {
      case 'blocked':
        filter.isBlocked = true;
        break;
      case 'unblocked':
        filter.isBlocked = false;
        break;
      default:
        break;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { userCode: { $regex: search, $options: 'i' } }
      ];
    }

    const totalUsers = await User.countDocuments(filter);

    const users = await User.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalUsers / limit);

    res.render('admin/users', {
      users,
      sortBy,
      searchQuery: search,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).send('Error listing users');
  }
};

exports.blockUser = async (req, res) => {
  try {
    
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: true });

    
    if (req.session.userId === user._id.toString()) {
      req.session.isBlocked = true; 
    }

    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).send('Error blocking user');
  }
};


exports.unblockUser = async (req, res) => {
  try {
    
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: false });

    
    if (req.session.userId === user._id.toString()) {
      req.session.isBlocked = false; 
    }

    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).send('Error unblocking user');
  }
};