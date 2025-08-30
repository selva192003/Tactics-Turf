const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const { authenticateToken } = require('../../middleware/auth');
const { validateRequest, authSchemas } = require('../../middleware/validation');
const { asyncHandler } = require('../../middleware/errorHandler');
const logger = require('../../services/logger');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', validateRequest(authSchemas.register), asyncHandler(async (req, res) => {
  const { username, email, password, fullName, phone, dateOfBirth, referralCode } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }, { phone }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email, username, or phone already exists'
      });
    }

    // Handle referral code
    let referredBy = null;
    if (referralCode) {
      referredBy = await User.findOne({ referralCode });
      if (!referredBy) {
        return res.status(400).json({
          success: false,
          message: 'Invalid referral code'
        });
      }
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      fullName,
      phone,
      dateOfBirth: new Date(dateOfBirth),
      referredBy: referredBy?._id
    });

    await user.save();

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Update referral earnings if applicable
    if (referredBy) {
      const referralBonus = 100; // ₹100 bonus for referral
      referredBy.referralEarnings += referralBonus;
      referredBy.wallet.balance += referralBonus;
      await referredBy.save();
    }

    // Log successful registration
    logger.info(`New user registered: ${username} (${email})`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: user.getPublicProfile(),
        token,
        refreshToken
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    throw error;
  }
}));

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', validateRequest(authSchemas.login), asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await user.updateLastLogin(req.ip, req.get('User-Agent'));

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Log successful login
    logger.info(`User logged in: ${user.username} (${user.email})`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.getPublicProfile(),
        token,
        refreshToken
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    throw error;
  }
}));

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token is required'
    });
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Check if user exists and is active
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Generate new tokens
    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired'
      });
    }
    
    logger.error('Token refresh error:', error);
    throw error;
  }
}));

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', validateRequest(authSchemas.forgotPassword), asyncHandler(async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user._id, type: 'reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Store reset token in user document (you might want to add a resetToken field to User model)
    // For now, we'll just log it
    logger.info(`Password reset requested for user: ${user.username} (${email})`);

    // TODO: Send email with reset link
    // const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent'
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    throw error;
  }
}));

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', validateRequest(authSchemas.resetPassword), asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  try {
    // Verify reset token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'reset') {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset token'
      });
    }

    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset token'
      });
    }

    // Update password
    user.password = password;
    await user.save();

    // Log password reset
    logger.info(`Password reset successful for user: ${user.username}`);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({
        success: false,
        message: 'Reset token has expired'
      });
    }
    
    logger.error('Password reset error:', error);
    throw error;
  }
}));

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.json({
      success: true,
      data: {
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    throw error;
  }
}));

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticateToken, asyncHandler(async (req, res) => {
  const { fullName, avatar, preferences } = req.body;

  try {
    const user = await User.findById(req.user._id);
    
    // Update allowed fields
    if (fullName) user.fullName = fullName;
    if (avatar) user.avatar = avatar;
    if (preferences) {
      if (preferences.favoriteSports) user.preferences.favoriteSports = preferences.favoriteSports;
      if (preferences.favoriteTeams) user.preferences.favoriteTeams = preferences.favoriteTeams;
      if (preferences.notifications) {
        user.preferences.notifications = { ...user.preferences.notifications, ...preferences.notifications };
      }
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    logger.error('Profile update error:', error);
    throw error;
  }
}));

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', authenticateToken, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Current password and new password are required'
    });
  }

  try {
    const user = await User.findById(req.user._id).select('+password');
    
    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Log password change
    logger.info(`Password changed for user: ${user.username}`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Change password error:', error);
    throw error;
  }
}));

// @route   POST /api/auth/logout
// @desc    Logout user (invalidate token)
// @access  Private
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
  try {
    // Log logout
    logger.info(`User logged out: ${req.user.username}`);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    throw error;
  }
}));

// @route   DELETE /api/auth/account
// @desc    Delete user account
// @access  Private
router.delete('/account', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Check if user has active contests or pending transactions
    // TODO: Add checks for active contests, pending transactions, etc.
    
    // Deactivate account instead of deleting
    user.isActive = false;
    await user.save();

    // Log account deactivation
    logger.info(`Account deactivated for user: ${user.username}`);

    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    logger.error('Account deletion error:', error);
    throw error;
  }
}));

// @route   GET /api/auth/verify-email/:token
// @desc    Verify user email
// @access  Public
router.get('/verify-email/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;

  try {
    // Verify email verification token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'email-verification') {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    // Find and update user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    user.isVerified = true;
    await user.save();

    // Log email verification
    logger.info(`Email verified for user: ${user.username}`);

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({
        success: false,
        message: 'Verification token has expired'
      });
    }
    
    logger.error('Email verification error:', error);
    throw error;
  }
}));

module.exports = router;