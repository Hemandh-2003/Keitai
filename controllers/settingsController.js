const User = require('../models/User');
const bcrypt = require('bcryptjs');
const {HTTP_STATUS}= require('../SM/status');

exports.getSettingsPage = (req, res) => {
  //console.log("Navigating to settings page.");
  res.render('user/settings', { user: req.session.user });
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "All fields are required." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Passwords do not match." });
    }

    const user = await User.findById(req.session.user._id);
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Current password is incorrect." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(HTTP_STATUS.OK).json({ message: "Password updated successfully!" });
  } catch (error) {
    console.error("Error in changing password:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: "An error occurred." });
  }
};

exports.updateUserName = async (req, res) => {
  const userId = req.session.user?._id; 
  const { name } = req.body;

  if (!userId) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: 'Unauthorized. Please log in.' });
  }

  if (!name || name.trim() === '') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Name cannot be empty.' });
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name: name.trim() }, 
      { new: true, runValidators: true } 
    );

    if (!updatedUser) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'User not found.' });
    }

    res.redirect('/user/profile'); 
  } catch (error) {
    console.error('Error updating user name:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'An error occurred while updating the name.' });
  }
};