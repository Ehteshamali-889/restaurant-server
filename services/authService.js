const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const login = async (username, password) => {
  const user = await User.findOne({ username }).select('+password');
  if (!user) {
    throw new Error('Invalid username or password');
  }

  if (!user.isActive) {
    throw new Error('Account is deactivated. Contact administrator.');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid username or password');
  }

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const token = generateToken(user._id);

  return {
    token,
    user: {
      id: user._id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      branch: user.branch,
    },
  };
};

const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
};

const getUsersByRole = async (role) => {
  const query = {};
  if (role) query.role = role;
  return User.find(query).select('fullName username role branch isActive');
};

module.exports = { login, getMe, getUsersByRole };
