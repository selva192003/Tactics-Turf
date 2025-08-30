const Notification = require('../models/Notification');
const { emit } = require('./websocket');
const logger = require('./logger');

class NotificationService {
  /**
   * Create and send a notification
   */
  static async createNotification(data) {
    try {
      const notification = new Notification(data);
      await notification.save();

      // Emit WebSocket event for real-time delivery
      emit.toUser(notification.userId, 'notification', {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
        metadata: notification.metadata,
        priority: notification.priority,
        category: notification.category
      });

      logger.info(`Notification created and sent: ${notification.type} to user ${notification.userId}`);

      return notification;
    } catch (error) {
      logger.error('Create notification error:', error);
      throw error;
    }
  }

  /**
   * Create multiple notifications for bulk operations
   */
  static async createBulkNotifications(notifications) {
    try {
      const createdNotifications = await Notification.createBulkNotifications(notifications);

      // Emit WebSocket events for all notifications
      createdNotifications.forEach(notification => {
        emit.toUser(notification.userId, 'notification', {
          id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          isRead: notification.isRead,
          createdAt: notification.createdAt,
          metadata: notification.metadata,
          priority: notification.priority,
          category: notification.category
        });
      });

      logger.info(`Bulk notifications created and sent: ${createdNotifications.length} notifications`);

      return createdNotifications;
    } catch (error) {
      logger.error('Create bulk notifications error:', error);
      throw error;
    }
  }

  /**
   * Send match start notification
   */
  static async sendMatchStartNotification(matchId, matchTitle, userIds, timeLeft = '15 minutes') {
    try {
      const notifications = userIds.map(userId => ({
        userId,
        type: 'match_start',
        title: 'Match Starting Soon',
        message: `Your fantasy match "${matchTitle}" is about to begin in ${timeLeft}`,
        priority: 'high',
        category: 'info',
        metadata: {
          matchId,
          matchTitle,
          timeLeft
        },
        source: 'automated',
        sourceId: matchId
      }));

      await this.createBulkNotifications(notifications);
      logger.info(`Match start notifications sent to ${userIds.length} users for match: ${matchTitle}`);
    } catch (error) {
      logger.error('Send match start notification error:', error);
      throw error;
    }
  }

  /**
   * Send contest result notification
   */
  static async sendContestResultNotification(contestId, contestName, userId, rank, prize) {
    try {
      const notification = await this.createNotification({
        userId,
        type: 'contest_result',
        title: 'Contest Results Available',
        message: `Your contest "${contestName}" results are ready. You finished ${rank}${rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'} and won ₹${prize}!`,
        priority: 'normal',
        category: 'success',
        metadata: {
          contestId,
          contestName,
          rank,
          prize
        },
        source: 'automated',
        sourceId: contestId
      });

      logger.info(`Contest result notification sent to user ${userId} for contest: ${contestName}`);
      return notification;
    } catch (error) {
      logger.error('Send contest result notification error:', error);
      throw error;
    }
  }

  /**
   * Send wallet update notification
   */
  static async sendWalletUpdateNotification(userId, type, amount, transactionId) {
    try {
      const action = type === 'deposit' ? 'credited' : type === 'withdrawal' ? 'debited' : 'updated';
      
      const notification = await this.createNotification({
        userId,
        type: 'wallet_update',
        title: 'Wallet Updated',
        message: `Your wallet has been ${action} with ₹${amount}`,
        priority: 'normal',
        category: 'info',
        metadata: {
          transactionId,
          amount,
          type,
          action
        },
        source: 'automated',
        sourceId: transactionId
      });

      logger.info(`Wallet update notification sent to user ${userId} for transaction: ${transactionId}`);
      return notification;
    } catch (error) {
      logger.error('Send wallet update notification error:', error);
      throw error;
    }
  }

  /**
   * Send leaderboard update notification
   */
  static async sendLeaderboardUpdateNotification(userId, contestId, contestName, oldRank, newRank) {
    try {
      if (oldRank === newRank) return null; // No change in rank

      const rankChange = oldRank - newRank;
      const message = rankChange > 0 
        ? `Congratulations! Your rank in "${contestName}" improved from ${oldRank} to ${newRank}`
        : `Your rank in "${contestName}" changed to ${newRank}`;

      const notification = await this.createNotification({
        userId,
        type: 'leaderboard_update',
        title: 'Leaderboard Update',
        message,
        priority: rankChange > 0 ? 'high' : 'normal',
        category: rankChange > 0 ? 'success' : 'info',
        metadata: {
          contestId,
          contestName,
          oldRank,
          newRank,
          rankChange
        },
        source: 'automated',
        sourceId: contestId
      });

      logger.info(`Leaderboard update notification sent to user ${userId} for contest: ${contestName}`);
      return notification;
    } catch (error) {
      logger.error('Send leaderboard update notification error:', error);
      throw error;
    }
  }

  /**
   * Send promotion notification
   */
  static async sendPromotionNotification(userIds, title, message, offerDescription) {
    try {
      const notifications = userIds.map(userId => ({
        userId,
        type: 'promotion',
        title,
        message,
        priority: 'normal',
        category: 'info',
        metadata: {
          offerDescription
        },
        source: 'admin',
        isBulk: true
      }));

      await this.createBulkNotifications(notifications);
      logger.info(`Promotion notifications sent to ${userIds.length} users: ${title}`);
    } catch (error) {
      logger.error('Send promotion notification error:', error);
      throw error;
    }
  }

  /**
   * Send system announcement
   */
  static async sendSystemAnnouncement(userIds, title, message, priority = 'normal') {
    try {
      const notifications = userIds.map(userId => ({
        userId,
        type: 'system',
        title,
        message,
        priority,
        category: 'info',
        source: 'admin',
        isBulk: true
      }));

      await this.createBulkNotifications(notifications);
      logger.info(`System announcement sent to ${userIds.length} users: ${title}`);
    } catch (error) {
      logger.error('Send system announcement error:', error);
      throw error;
    }
  }

  /**
   * Send referral notification
   */
  static async sendReferralNotification(userId, referredUsername, bonus) {
    try {
      const notification = await this.createNotification({
        userId,
        type: 'referral',
        title: 'Referral Bonus Earned',
        message: `Congratulations! You earned ₹${bonus} for referring ${referredUsername}`,
        priority: 'normal',
        category: 'success',
        metadata: {
          referredUsername,
          bonus
        },
        source: 'automated'
      });

      logger.info(`Referral notification sent to user ${userId} for referring ${referredUsername}`);
      return notification;
    } catch (error) {
      logger.error('Send referral notification error:', error);
      throw error;
    }
  }

  /**
   * Send achievement notification
   */
  static async sendAchievementNotification(userId, achievementName, description, points) {
    try {
      const notification = await this.createNotification({
        userId,
        type: 'achievement',
        title: `Achievement Unlocked: ${achievementName}`,
        message: description,
        priority: 'high',
        category: 'success',
        metadata: {
          achievementName,
          points
        },
        source: 'automated'
      });

      logger.info(`Achievement notification sent to user ${userId} for: ${achievementName}`);
      return notification;
    } catch (error) {
      logger.error('Send achievement notification error:', error);
      throw error;
    }
  }

  /**
   * Send reminder notification
   */
  static async sendReminderNotification(userId, type, title, message, metadata = {}) {
    try {
      const notification = await this.createNotification({
        userId,
        type: 'reminder',
        title,
        message,
        priority: 'normal',
        category: 'info',
        metadata,
        source: 'automated'
      });

      logger.info(`Reminder notification sent to user ${userId}: ${title}`);
      return notification;
    } catch (error) {
      logger.error('Send reminder notification error:', error);
      throw error;
    }
  }

  /**
   * Schedule notification for future delivery
   */
  static async scheduleNotification(data, scheduledFor) {
    try {
      const notification = new Notification({
        ...data,
        scheduledFor,
        'deliveryChannels.inApp.sent': false
      });

      await notification.save();
      logger.info(`Notification scheduled for ${scheduledFor}: ${notification.title}`);
      return notification;
    } catch (error) {
      logger.error('Schedule notification error:', error);
      throw error;
    }
  }

  /**
   * Process scheduled notifications
   */
  static async processScheduledNotifications() {
    try {
      const scheduledNotifications = await Notification.getScheduledNotifications();
      
      for (const notification of scheduledNotifications) {
        try {
          // Mark as sent
          await notification.markAsSent('inApp');
          
          // Emit WebSocket event
          emit.toUser(notification.userId, 'notification', {
            id: notification._id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            isRead: notification.isRead,
            createdAt: notification.createdAt,
            metadata: notification.metadata,
            priority: notification.priority,
            category: notification.category
          });

          logger.info(`Scheduled notification processed: ${notification.title}`);
        } catch (error) {
          logger.error(`Process scheduled notification error for ${notification._id}:`, error);
          
          // Mark as failed and retry if possible
          if (notification.retryCount < notification.maxRetries) {
            await notification.retry();
          } else {
            await notification.markAsFailed('inApp', error.message);
          }
        }
      }

      logger.info(`Processed ${scheduledNotifications.length} scheduled notifications`);
    } catch (error) {
      logger.error('Process scheduled notifications error:', error);
      throw error;
    }
  }

  /**
   * Clean up expired notifications
   */
  static async cleanupExpiredNotifications() {
    try {
      const expiredNotifications = await Notification.getExpiredNotifications();
      
      for (const notification of expiredNotifications) {
        await notification.softDelete();
      }

      logger.info(`Cleaned up ${expiredNotifications.length} expired notifications`);
    } catch (error) {
      logger.error('Cleanup expired notifications error:', error);
      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  static async getNotificationStats(userId, period = '30d') {
    try {
      let startDate;
      const now = new Date();
      
      switch (period) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const stats = await Notification.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            createdAt: { $gte: startDate },
            isDeleted: false
          }
        },
        {
          $group: {
            _id: {
              type: '$type',
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
            },
            count: { $sum: 1 },
            readCount: { $sum: { $cond: ['$isRead', 1, 0] } }
          }
        },
        {
          $sort: { '_id.date': 1 }
        }
      ]);

      return stats;
    } catch (error) {
      logger.error('Get notification stats error:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;
