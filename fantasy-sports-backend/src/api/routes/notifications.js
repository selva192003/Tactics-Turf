const express = require('express');
const User = require('../../models/User');
const Notification = require('../../models/Notification');
const { authenticateToken, optionalAuth } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');
const { cache } = require('../../services/redis');
const { emit } = require('../../services/websocket');
const logger = require('../../services/logger');

const router = express.Router();

// @route   GET /api/notifications
// @desc    Get user notifications
// @access  Private
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const {
    type,
    isRead,
    page = 1,
    limit = 20
  } = req.query;

  try {
    // Build filter object
    const filter = { userId: req.user._id };
    
    if (type) filter.type = type;
    if (isRead !== undefined) filter.isRead = isRead === 'true';

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get notifications using the Notification model
    const notifications = await Notification.getUserNotifications(req.user._id, {
      type,
      isRead: isRead === 'true',
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });

    const total = await Notification.countDocuments(filter);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Get notifications error:', error);
    throw error;
  }
}));

// @route   GET /api/notifications/unread-count
// @desc    Get count of unread notifications
// @access  Private
router.get('/unread-count', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const unreadCount = await Notification.getUnreadCount(req.user._id);

    res.json({
      success: true,
      data: { unreadCount }
    });
  } catch (error) {
    logger.error('Get unread count error:', error);
    throw error;
  }
}));

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const notification = await Notification.findById(id);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check if notification belongs to user
    if (notification.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await notification.markAsRead();
    
    logger.info(`User ${req.user.username} marked notification ${id} as read`);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    logger.error(`Mark notification read error: ${error.message}`);
    throw error;
  }
}));

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', authenticateToken, asyncHandler(async (req, res) => {
  try {
    await Notification.markAllAsRead(req.user._id);
    
    logger.info(`User ${req.user.username} marked all notifications as read`);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error(`Mark all notifications read error: ${error.message}`);
    throw error;
  }
}));

// @route   DELETE /api/notifications/:id
// @desc    Delete notification
// @access  Private
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const notification = await Notification.findById(id);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check if notification belongs to user
    if (notification.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await notification.softDelete();
    
    logger.info(`User ${req.user.username} deleted notification ${id}`);

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    logger.error(`Delete notification error: ${error.message}`);
    throw error;
  }
}));

// @route   DELETE /api/notifications/clear-all
// @desc    Clear all notifications
// @access  Private
router.delete('/clear-all', authenticateToken, asyncHandler(async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isDeleted: false },
      { isDeleted: true }
    );
    
    logger.info(`User ${req.user.username} cleared all notifications`);

    res.json({
      success: true,
      message: 'All notifications cleared successfully'
    });
  } catch (error) {
    logger.error(`Clear all notifications error: ${error.message}`);
    throw error;
  }
}));

// @route   GET /api/notifications/settings
// @desc    Get user notification settings
// @access  Private
router.get('/settings', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('preferences.notifications');
    
    const notificationSettings = user.preferences?.notifications || {
      email: {
        matchStart: true,
        contestResults: true,
        walletUpdates: true,
        promotions: false,
        weeklyDigest: true
      },
      push: {
        matchStart: true,
        contestResults: true,
        walletUpdates: true,
        promotions: false,
        leaderboardUpdates: true
      },
      sms: {
        matchStart: false,
        contestResults: false,
        walletUpdates: false,
        promotions: false
      }
    };

    res.json({
      success: true,
      data: notificationSettings
    });
  } catch (error) {
    logger.error('Get notification settings error:', error);
    throw error;
  }
}));

// @route   PUT /api/notifications/settings
// @desc    Update user notification settings
// @access  Private
router.put('/settings', authenticateToken, asyncHandler(async (req, res) => {
  const { email, push, sms } = req.body;

  try {
    const user = await User.findById(req.user._id);
    
    if (!user.preferences) {
      user.preferences = {};
    }
    
    user.preferences.notifications = {
      email: email || user.preferences.notifications?.email || {},
      push: push || user.preferences.notifications?.push || {},
      sms: sms || user.preferences.notifications?.sms || {}
    };

    await user.save();

    logger.info(`User ${req.user.username} updated notification settings`);

    res.json({
      success: true,
      message: 'Notification settings updated successfully',
      data: user.preferences.notifications
    });
  } catch (error) {
    logger.error('Update notification settings error:', error);
    throw error;
  }
}));

// @route   POST /api/notifications/test
// @desc    Send test notification
// @access  Private
router.post('/test', authenticateToken, asyncHandler(async (req, res) => {
  const { type = 'test' } = req.body;

  try {
    // Send test notification via WebSocket
    emit.toUser(req.user._id, 'notification', {
      type,
      title: 'Test Notification',
      message: 'This is a test notification to verify your settings',
      isRead: false,
      createdAt: new Date(),
      metadata: {
        test: true
      }
    });

    logger.info(`Test notification sent to user ${req.user.username}`);

    res.json({
      success: true,
      message: 'Test notification sent successfully'
    });
  } catch (error) {
    logger.error('Send test notification error:', error);
    throw error;
  }
}));

// @route   GET /api/notifications/templates
// @desc    Get notification templates (for admin reference)
// @access  Private (Admin)
router.get('/templates', authenticateToken, asyncHandler(async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const templates = {
      match_start: {
        title: 'Match Starting Soon',
        message: 'Your fantasy match {matchTitle} is about to begin in {timeLeft}',
        variables: ['matchTitle', 'timeLeft']
      },
      contest_result: {
        title: 'Contest Results Available',
        message: 'Your contest {contestName} results are ready. You finished {rank} and won ₹{prize}!',
        variables: ['contestName', 'rank', 'prize']
      },
      wallet_update: {
        title: 'Wallet Updated',
        message: 'Your wallet has been {action} with ₹{amount}',
        variables: ['action', 'amount']
      },
      leaderboard_update: {
        title: 'Leaderboard Update',
        message: 'Your rank in {contestName} has changed to {rank}',
        variables: ['contestName', 'rank']
      },
      promotion: {
        title: 'Special Offer',
        message: 'Limited time offer: {offerDescription}',
        variables: ['offerDescription']
      }
    };

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    logger.error('Get notification templates error:', error);
    throw error;
  }
}));

// @route   POST /api/notifications/bulk
// @desc    Send bulk notifications (Admin only)
// @access  Private (Admin)
router.post('/bulk', authenticateToken, asyncHandler(async (req, res) => {
  const { type, title, message, targetUsers, filters } = req.body;

  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    if (!type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Type, title, and message are required'
      });
    }

    // Build user filter
    let userFilter = {};
    
    if (targetUsers === 'all') {
      userFilter = { isActive: true };
    } else if (targetUsers === 'verified') {
      userFilter = { isActive: true, isVerified: true };
    } else if (targetUsers === 'premium') {
      userFilter = { isActive: true, 'preferences.isPremium': true };
    } else if (filters) {
      userFilter = { ...filters, isActive: true };
    }

    // Get target users
    const users = await User.find(userFilter).select('_id username email');
    
    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No users found matching the criteria'
      });
    }

    // Send notifications to all target users
    users.forEach(user => {
      emit.toUser(user._id, 'notification', {
        type,
        title,
        message,
        isRead: false,
        createdAt: new Date(),
        metadata: {
          bulk: true,
          sentBy: req.user.username
        }
      });
    });

    // Log bulk notification
    logger.info(`Admin ${req.user.username} sent bulk notification to ${users.length} users: ${title}`);

    res.json({
      success: true,
      message: `Bulk notification sent to ${users.length} users successfully`,
      data: {
        sentTo: users.length,
        type,
        title
      }
    });
  } catch (error) {
    logger.error('Send bulk notification error:', error);
    throw error;
  }
}));

module.exports = router;
