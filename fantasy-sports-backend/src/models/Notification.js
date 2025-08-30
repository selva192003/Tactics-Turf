const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'match_start',
      'match_end',
      'contest_result',
      'wallet_update',
      'leaderboard_update',
      'promotion',
      'system',
      'referral',
      'achievement',
      'reminder',
      'test'
    ],
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  category: {
    type: String,
    enum: ['info', 'success', 'warning', 'error'],
    default: 'info'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Delivery channels
  deliveryChannels: {
    email: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      error: String
    },
    push: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      error: String
    },
    sms: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      error: String
    },
    inApp: {
      sent: { type: Boolean, default: true },
      sentAt: { type: Date, default: Date.now }
    }
  },
  // Scheduling
  scheduledFor: {
    type: Date,
    index: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    index: true
  },
  // Retry mechanism
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  nextRetryAt: {
    type: Date
  },
  // User interaction
  clickedAt: Date,
  actionTaken: {
    type: String,
    enum: ['viewed', 'clicked', 'dismissed', 'actioned']
  },
  // Template information
  templateId: String,
  templateVersion: String,
  variables: [String],
  // Batch information for bulk notifications
  batchId: String,
  isBulk: {
    type: Boolean,
    default: false
  },
  // Source information
  source: {
    type: String,
    enum: ['system', 'admin', 'automated', 'user_action'],
    default: 'system'
  },
  sourceId: String, // ID of the source (e.g., match ID, contest ID)
  sourceUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ priority: 1, createdAt: -1 });
notificationSchema.index({ scheduledFor: 1, isDeleted: false });
notificationSchema.index({ expiresAt: 1, isDeleted: false });

// Virtual for notification age
notificationSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Virtual for time until scheduled
notificationSchema.virtual('timeUntilScheduled').get(function() {
  if (!this.scheduledFor) return null;
  return this.scheduledFor.getTime() - Date.now();
});

// Virtual for notification status
notificationSchema.virtual('status').get(function() {
  if (this.isDeleted) return 'deleted';
  if (this.isRead) return 'read';
  if (this.scheduledFor && this.scheduledFor > new Date()) return 'scheduled';
  if (this.expiresAt && this.expiresAt < new Date()) return 'expired';
  return 'unread';
});

// Instance methods
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

notificationSchema.methods.markAsUnread = function() {
  this.isRead = false;
  return this.save();
};

notificationSchema.methods.softDelete = function() {
  this.isDeleted = true;
  return this.save();
};

notificationSchema.methods.hardDelete = function() {
  return this.deleteOne();
};

notificationSchema.methods.retry = function() {
  if (this.retryCount < this.maxRetries) {
    this.retryCount += 1;
    this.nextRetryAt = new Date(Date.now() + Math.pow(2, this.retryCount) * 1000 * 60); // Exponential backoff
    return this.save();
  }
  throw new Error('Max retries exceeded');
};

notificationSchema.methods.markAsSent = function(channel = 'inApp') {
  if (this.deliveryChannels[channel]) {
    this.deliveryChannels[channel].sent = true;
    this.deliveryChannels[channel].sentAt = new Date();
  }
  return this.save();
};

notificationSchema.methods.markAsFailed = function(channel = 'inApp', error = '') {
  if (this.deliveryChannels[channel]) {
    this.deliveryChannels[channel].sent = false;
    this.deliveryChannels[channel].error = error;
  }
  return this.save();
};

notificationSchema.methods.click = function() {
  this.clickedAt = new Date();
  this.actionTaken = 'clicked';
  return this.save();
};

notificationSchema.methods.dismiss = function() {
  this.actionTaken = 'dismissed';
  return this.save();
};

// Static methods
notificationSchema.statics.createNotification = function(data) {
  return new this(data);
};

notificationSchema.statics.createBulkNotifications = function(notifications) {
  return this.insertMany(notifications);
};

notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    userId,
    isRead: false,
    isDeleted: false,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

notificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    {
      userId,
      isRead: false,
      isDeleted: false
    },
    {
      isRead: true
    }
  );
};

notificationSchema.statics.deleteOldNotifications = function(daysOld = 90) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    isRead: true
  });
};

notificationSchema.statics.getScheduledNotifications = function() {
  return this.find({
    scheduledFor: { $lte: new Date() },
    isDeleted: false,
    'deliveryChannels.inApp.sent': false
  });
};

notificationSchema.statics.getExpiredNotifications = function() {
  return this.find({
    expiresAt: { $lt: new Date() },
    isDeleted: false
  });
};

notificationSchema.statics.getUserNotifications = function(userId, options = {}) {
  const {
    type,
    isRead,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = options;

  const filter = {
    userId,
    isDeleted: false
  };

  if (type) filter.type = type;
  if (isRead !== undefined) filter.isRead = isRead;

  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const skip = (page - 1) * limit;

  return this.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

// Pre-save middleware
notificationSchema.pre('save', function(next) {
  // Set default expiration if not set (30 days from creation)
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  // Set scheduled time if not set
  if (!this.scheduledFor) {
    this.scheduledFor = new Date();
  }

  next();
});

// Pre-find middleware to exclude deleted notifications by default
notificationSchema.pre(/^find/, function(next) {
  if (!this.getQuery().isDeleted) {
    this.where({ isDeleted: false });
  }
  next();
});

// Post-save middleware to emit WebSocket event
notificationSchema.post('save', function(doc) {
  // Emit WebSocket event for real-time notification
  // This will be handled by the notification service
  if (doc.isNew && !doc.isDeleted) {
    // TODO: Emit WebSocket event
  }
});

module.exports = mongoose.model('Notification', notificationSchema);
