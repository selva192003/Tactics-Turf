const express = require('express');
const router = express.Router();
const { authenticateToken, authenticateAdmin } = require('../../middleware/auth');
const { validateRequest } = require('../../middleware/validation');
const { asyncHandler } = require('../../middleware/errorHandler');
const { cache } = require('../../services/redis');
const { events } = require('../../services/websocket');
const Joi = require('joi');

// Import models (you'll need to create these)
// const Notification = require('../../models/Notification');
// const User = require('../../models/User');

// Validation schemas
const notificationSchemas = {
  create: Joi.object({
    title: Joi.string().required().max(100),
    message: Joi.string().required().max(500),
    type: Joi.string().valid('info', 'success', 'warning', 'error', 'contest', 'match', 'payment', 'system').required(),
    priority: Joi.string().valid('low', 'normal', 'high', 'urgent').default('normal'),
    targetUsers: Joi.array().items(Joi.string()).optional(), // User IDs
    targetGroups: Joi.array().items(Joi.string()).valid('all', 'premium', 'new_users', 'contest_winners').optional(),
    scheduledAt: Joi.date().optional(),
    expiresAt: Joi.date().optional(),
    actionUrl: Joi.string().uri().optional(),
    actionText: Joi.string().max(50).optional(),
    metadata: Joi.object().optional()
  }),
  
  update: Joi.object({
    title: Joi.string().max(100),
    message: Joi.string().max(500),
    type: Joi.string().valid('info', 'success', 'warning', 'error', 'contest', 'match', 'payment', 'system'),
    priority: Joi.string().valid('low', 'normal', 'high', 'urgent'),
    targetUsers: Joi.array().items(Joi.string()),
    targetGroups: Joi.array().items(Joi.string()).valid('all', 'premium', 'new_users', 'contest_winners'),
    scheduledAt: Joi.date(),
    expiresAt: Joi.date(),
    actionUrl: Joi.string().uri(),
    actionText: Joi.string().max(50),
    metadata: Joi.object(),
    isActive: Joi.boolean()
  }),
  
  markRead: Joi.object({
    notificationIds: Joi.array().items(Joi.string()).required()
  }),
  
  preferences: Joi.object({
    email: Joi.boolean(),
    push: Joi.boolean(),
    sms: Joi.boolean(),
    inApp: Joi.boolean(),
    types: Joi.object({
      contest: Joi.boolean(),
      match: Joi.boolean(),
      payment: Joi.boolean(),
      system: Joi.boolean(),
      marketing: Joi.boolean()
    })
  })
};

// Get user's notifications with pagination and filters
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type, isRead, priority } = req.query;
  const userId = req.user.id;
  
  // Build filter object
  const filter = { userId };
  if (type) filter.type = type;
  if (isRead !== undefined) filter.isRead = isRead === 'true';
  if (priority) filter.priority = priority;
  
  // TODO: Implement actual notification fetching
  // const notifications = await Notification.find(filter)
  //   .sort({ createdAt: -1 })
  //   .limit(limit * 1)
  //   .skip((page - 1) * limit);
  
  // const total = await Notification.countDocuments(filter);
  
  // Mock response for now
  const notifications = [
    {
      id: '1',
      title: 'Welcome to Tactics Turf!',
      message: 'Start building your fantasy team and join contests to win big!',
      type: 'info',
      priority: 'normal',
      isRead: false,
      createdAt: new Date(),
      actionUrl: '/contests',
      actionText: 'Browse Contests'
    }
  ];
  
  res.json({
    success: true,
    data: {
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 1,
        pages: 1
      }
    }
  });
}));

// Get unread notification count
router.get('/me/unread-count', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  // TODO: Implement actual count
  // const count = await Notification.countDocuments({ userId, isRead: false });
  
  res.json({
    success: true,
    data: { unreadCount: 1 }
  });
}));

// Mark notifications as read
router.post('/me/mark-read', authenticateToken, validateRequest(notificationSchemas.markRead), asyncHandler(async (req, res) => {
  const { notificationIds } = req.body;
  const userId = req.user.id;
  
  // TODO: Implement actual marking as read
  // await Notification.updateMany(
  //   { _id: { $in: notificationIds }, userId },
  //   { isRead: true, readAt: new Date() }
  // );
  
  // Emit real-time update
  events.emitToUser(userId, 'notifications:updated', { unreadCount: 0 });
  
  res.json({
    success: true,
    message: 'Notifications marked as read'
  });
}));

// Mark all user notifications as read
router.post('/me/mark-all-read', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  // TODO: Implement actual marking all as read
  // await Notification.updateMany(
  //   { userId, isRead: false },
  //   { isRead: true, readAt: new Date() }
  // );
  
  // Emit real-time update
  events.emitToUser(userId, 'notifications:updated', { unreadCount: 0 });
  
  res.json({
    success: true,
    message: 'All notifications marked as read'
  });
}));

// Get user notification preferences
router.get('/me/preferences', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  // TODO: Get from user model or separate preferences model
  const preferences = {
    email: true,
    push: true,
    sms: false,
    inApp: true,
    types: {
      contest: true,
      match: true,
      payment: true,
      system: true,
      marketing: false
    }
  };
  
  res.json({
    success: true,
    data: preferences
  });
}));

// Update user notification preferences
router.put('/me/preferences', authenticateToken, validateRequest(notificationSchemas.preferences), asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const preferences = req.body;
  
  // TODO: Update user preferences
  // await User.findByIdAndUpdate(userId, { notificationPreferences: preferences });
  
  res.json({
    success: true,
    message: 'Notification preferences updated',
    data: preferences
  });
}));

// Delete user notification
router.delete('/me/:notificationId', authenticateToken, asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.user.id;
  
  // TODO: Implement actual deletion
  // await Notification.findOneAndDelete({ _id: notificationId, userId });
  
  res.json({
    success: true,
    message: 'Notification deleted'
  });
}));

// ADMIN ROUTES

// Get all notifications (admin)
router.get('/', authenticateAdmin, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type, priority, isActive, targetGroup } = req.query;
  
  // Build filter object
  const filter = {};
  if (type) filter.type = type;
  if (priority) filter.priority = priority;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (targetGroup) filter.targetGroups = targetGroup;
  
  // TODO: Implement actual notification fetching
  // const notifications = await Notification.find(filter)
  //   .sort({ createdAt: -1 })
  //   .limit(limit * 1)
  //   .skip((page - 1) * limit);
  
  // const total = await Notification.countDocuments(filter);
  
  // Mock response for now
  const notifications = [
    {
      id: '1',
      title: 'System Maintenance',
      message: 'Scheduled maintenance on Sunday 2-4 AM',
      type: 'system',
      priority: 'high',
      targetGroups: ['all'],
      isActive: true,
      createdAt: new Date(),
      createdBy: 'admin'
    }
  ];
  
  res.json({
    success: true,
    data: {
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 1,
        pages: 1
      }
    }
  });
}));

// Create new notification (admin)
router.post('/', authenticateAdmin, validateRequest(notificationSchemas.create), asyncHandler(async (req, res) => {
  const notificationData = req.body;
  const adminId = req.user.id;
  
  // TODO: Implement actual notification creation
  // const notification = new Notification({
  //   ...notificationData,
  //   createdBy: adminId,
  //   isActive: true
  // });
  // await notification.save();
  
  // Send notifications to target users
  if (notificationData.targetUsers && notificationData.targetUsers.length > 0) {
    // Send to specific users
    events.emitToUsers(notificationData.targetUsers, 'notifications:new', {
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type,
      priority: notificationData.priority
    });
  } else if (notificationData.targetGroups && notificationData.targetGroups.length > 0) {
    // Send to groups (broadcast to all connected users for now)
    events.emitToAll('notifications:new', {
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type,
      priority: notificationData.priority
    });
  }
  
  // Clear cache
  await cache.del('notifications:all');
  
  res.status(201).json({
    success: true,
    message: 'Notification created successfully',
    data: { id: 'new-id', ...notificationData }
  });
}));

// Update notification (admin)
router.put('/:notificationId', authenticateAdmin, validateRequest(notificationSchemas.update), asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const updateData = req.body;
  
  // TODO: Implement actual notification update
  // const notification = await Notification.findByIdAndUpdate(
  //   notificationId,
  //   updateData,
  //   { new: true }
  // );
  
  // Clear cache
  await cache.del('notifications:all');
  
  res.json({
    success: true,
    message: 'Notification updated successfully',
    data: { id: notificationId, ...updateData }
  });
}));

// Delete notification (admin)
router.delete('/:notificationId', authenticateAdmin, asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  
  // TODO: Implement actual notification deletion
  // await Notification.findByIdAndDelete(notificationId);
  
  // Clear cache
  await cache.del('notifications:all');
  
  res.json({
    success: true,
    message: 'Notification deleted successfully'
  });
}));

// Toggle notification active status (admin)
router.patch('/:notificationId/toggle', authenticateAdmin, asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  
  // TODO: Implement actual toggle
  // const notification = await Notification.findById(notificationId);
  // notification.isActive = !notification.isActive;
  // await notification.save();
  
  // Clear cache
  await cache.del('notifications:all');
  
  res.json({
    success: true,
    message: 'Notification status toggled',
    data: { isActive: true } // Mock response
  });
}));

// Get notification statistics (admin)
router.get('/stats', authenticateAdmin, asyncHandler(async (req, res) => {
  // TODO: Implement actual statistics
  const stats = {
    total: 150,
    unread: 45,
    byType: {
      contest: 60,
      match: 40,
      payment: 20,
      system: 20,
      marketing: 10
    },
    byPriority: {
      low: 30,
      normal: 80,
      high: 30,
      urgent: 10
    },
    deliveryStats: {
      email: { sent: 1200, delivered: 1150, failed: 50 },
      push: { sent: 800, delivered: 750, failed: 50 },
      sms: { sent: 300, delivered: 280, failed: 20 }
    }
  };
  
  res.json({
    success: true,
    data: stats
  });
}));

// Send test notification (admin)
router.post('/test', authenticateAdmin, validateRequest(notificationSchemas.create), asyncHandler(async (req, res) => {
  const notificationData = req.body;
  const adminId = req.user.id;
  
  // Send test notification to admin
  events.emitToUser(adminId, 'notifications:test', {
    title: notificationData.title,
    message: notificationData.message,
    type: notificationData.type,
    priority: notificationData.priority
  });
  
  res.json({
    success: true,
    message: 'Test notification sent successfully'
  });
}));

// Bulk send notifications (admin)
router.post('/bulk', authenticateAdmin, asyncHandler(async (req, res) => {
  const { notifications, targetUsers, targetGroups } = req.body;
  
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Notifications array is required'
    });
  }
  
  // TODO: Implement bulk notification sending
  // for (const notification of notifications) {
  //   // Create and send each notification
  // }
  
  // Clear cache
  await cache.del('notifications:all');
  
  res.json({
    success: true,
    message: `${notifications.length} notifications sent successfully`
  });
}));

module.exports = router;
