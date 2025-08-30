const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Basic notification info
  title: {
    type: String,
    required: true,
    maxlength: 100,
    trim: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 500,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['info', 'success', 'warning', 'error', 'contest', 'match', 'payment', 'system', 'marketing'],
    default: 'info'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  // Target audience
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() { return !this.targetGroups || this.targetGroups.length === 0; }
  },
  targetUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  targetGroups: [{
    type: String,
    enum: ['all', 'premium', 'new_users', 'contest_winners', 'verified_users', 'active_users']
  }],
  
  // Timing
  scheduledAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date
  },
  
  // Action and metadata
  actionUrl: {
    type: String,
    maxlength: 500
  },
  actionText: {
    type: String,
    maxlength: 50
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Status and tracking
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  
  // Delivery tracking
  deliveryStatus: {
    email: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      delivered: { type: Boolean, default: false },
      deliveredAt: Date,
      failed: { type: Boolean, default: false },
      failureReason: String
    },
    push: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      delivered: { type: Boolean, default: false },
      deliveredAt: Date,
      failed: { type: Boolean, default: false },
      failureReason: String
    },
    sms: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      delivered: { type: Boolean, default: false },
      deliveredAt: Date,
      failed: { type: Boolean, default: false },
      failureReason: String
    },
    inApp: {
      sent: { type: Boolean, default: true },
      sentAt: { type: Date, default: Date.now }
    }
  },
  
  // Related entities
  relatedMatch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match'
  },
  relatedContest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contest'
  },
  relatedTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  relatedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Creator info
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // System fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ targetGroups: 1, isActive: 1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ scheduledAt: 1, isActive: 1 });
notificationSchema.index({ expiresAt: 1, isActive: 1 });
notificationSchema.index({ createdAt: -1 });

// Virtual fields
notificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

notificationSchema.virtual('isScheduled').get(function() {
  return this.scheduledAt && new Date() < this.scheduledAt;
});

notificationSchema.virtual('canDeliver').get(function() {
  return this.isActive && !this.isDeleted && !this.isExpired && !this.isScheduled;
});

notificationSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Pre-save middleware
notificationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Set default scheduledAt if not provided
  if (!this.scheduledAt) {
    this.scheduledAt = new Date();
  }
  
  next();
});

// Instance methods
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsUnread = function() {
  this.isRead = false;
  this.readAt = undefined;
  return this.save();
};

notificationSchema.methods.activate = function() {
  this.isActive = true;
  return this.save();
};

notificationSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

notificationSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.isActive = false;
  return this.save();
};

notificationSchema.methods.updateDeliveryStatus = function(channel, status, details = {}) {
  if (this.deliveryStatus[channel]) {
    this.deliveryStatus[channel] = { ...this.deliveryStatus[channel], ...status, ...details };
    if (status.sent) this.deliveryStatus[channel].sentAt = new Date();
    if (status.delivered) this.deliveryStatus[channel].deliveredAt = new Date();
  }
  return this.save();
};

// Static methods
notificationSchema.statics.getUserNotifications = async function(userId, options = {}) {
  const {
    type,
    isRead,
    priority,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = options;
  
  const filter = { userId, isDeleted: false };
  if (type) filter.type = type;
  if (isRead !== undefined) filter.isRead = isRead;
  if (priority) filter.priority = priority;
  
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
  
  const skip = (page - 1) * limit;
  
  const notifications = await this.find(filter)
    .sort(sort)
    .limit(limit)
    .skip(skip)
    .populate('relatedMatch', 'title sport teams')
    .populate('relatedContest', 'name entryFee prizePool')
    .populate('relatedTransaction', 'type amount status')
    .populate('relatedUser', 'username avatar')
    .lean();
  
  return notifications;
};

notificationSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({
    userId,
    isRead: false,
    isDeleted: false,
    isActive: true
  });
};

notificationSchema.statics.markAllAsRead = async function(userId) {
  return await this.updateMany(
    { userId, isRead: false, isDeleted: false },
    { isRead: true, readAt: new Date() }
  );
};

notificationSchema.statics.getNotificationsByGroup = async function(targetGroups, options = {}) {
  const {
    type,
    priority,
    isActive = true,
    page = 1,
    limit = 20
  } = options;
  
  const filter = { targetGroups: { $in: targetGroups }, isDeleted: false };
  if (type) filter.type = type;
  if (priority) filter.priority = priority;
  if (isActive !== undefined) filter.isActive = isActive;
  
  const skip = (page - 1) * limit;
  
  const notifications = await this.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('createdBy', 'username')
    .lean();
  
  return notifications;
};

notificationSchema.statics.createSystemNotification = async function(data) {
  const notification = new this({
    ...data,
    type: 'system',
    createdBy: data.createdBy || 'system',
    isActive: true
  });
  
  return await notification.save();
};

notificationSchema.statics.createBulkNotifications = async function(notificationData, targetUserIds) {
  const notifications = targetUserIds.map(userId => ({
    ...notificationData,
    userId,
    isActive: true
  }));
  
  return await this.insertMany(notifications);
};

// Cleanup expired notifications (run periodically)
notificationSchema.statics.cleanupExpired = async function() {
  const result = await this.updateMany(
    { expiresAt: { $lt: new Date() }, isActive: true },
    { isActive: false }
  );
  
  return result.modifiedCount;
};

// Get notification statistics
notificationSchema.statics.getStats = async function(userId = null) {
  const matchStage = userId ? { userId } : {};
  
  const stats = await this.aggregate([
    { $match: { ...matchStage, isDeleted: false } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unread: { $sum: { $cond: ['$isRead', 0, 1] } },
        byType: {
          $push: {
            type: '$type',
            count: 1
          }
        },
        byPriority: {
          $push: {
            priority: '$priority',
            count: 1
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        total: 1,
        unread: 1,
        byType: {
          $arrayToObject: {
            $map: {
              input: '$byType',
              as: 'item',
              in: { k: '$$item.type', v: '$$item.count' }
            }
          }
        },
        byPriority: {
          $arrayToObject: {
            $map: {
              input: '$byPriority',
              as: 'item',
              in: { k: '$$item.priority', v: '$$item.count' }
            }
          }
        }
      }
    }
  ]);
  
  return stats[0] || { total: 0, unread: 0, byType: {}, byPriority: {} };
};

module.exports = mongoose.model('Notification', notificationSchema);
