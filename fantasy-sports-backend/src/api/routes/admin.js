const express = require('express');
const User = require('../../models/User');
const Match = require('../../models/Match');
const Contest = require('../../models/Contest');
const Transaction = require('../../models/Transaction');
const { authenticateAdmin, authenticateSuperAdmin } = require('../../middleware/auth');
const { validateRequest, adminSchemas } = require('../../middleware/validation');
const { asyncHandler } = require('../../middleware/errorHandler');
const { cache } = require('../../services/redis');
const logger = require('../../services/logger');

const router = express.Router();

// All admin routes require admin authentication
router.use(authenticateAdmin);

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin)
router.get('/dashboard', asyncHandler(async (req, res) => {
  try {
    // Get platform statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const totalMatches = await Match.countDocuments();
    const liveMatches = await Match.countDocuments({ status: 'live' });
    const totalContests = await Contest.countDocuments();
    const activeContests = await Contest.countDocuments({ isActive: true });

    // Get financial statistics
    const totalDeposits = await Transaction.aggregate([
      { $match: { type: 'deposit', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalWithdrawals = await Transaction.aggregate([
      { $match: { type: 'withdrawal', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalContestEntries = await Transaction.aggregate([
      { $match: { type: 'contest_entry', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get recent activities
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('username email fullName createdAt');

    const recentTransactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'username')
      .select('type amount status createdAt userId');

    const dashboardData = {
      overview: {
        totalUsers,
        activeUsers,
        totalMatches,
        liveMatches,
        totalContests,
        activeContests
      },
      financial: {
        totalDeposits: totalDeposits[0]?.total || 0,
        totalWithdrawals: totalWithdrawals[0]?.total || 0,
        totalContestEntries: Math.abs(totalContestEntries[0]?.total || 0),
        netRevenue: (totalDeposits[0]?.total || 0) - (totalWithdrawals[0]?.total || 0)
      },
      recentActivities: {
        users: recentUsers,
        transactions: recentTransactions
      }
    };

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    logger.error('Get admin dashboard error:', error);
    throw error;
  }
}));

// @route   GET /api/admin/users
// @desc    Get all users with filters
// @access  Private (Admin)
router.get('/users', asyncHandler(async (req, res) => {
  const {
    role,
    status,
    search,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  try {
    // Build filter object
    const filter = {};
    
    if (role) filter.role = role;
    if (status !== undefined) filter.isActive = status === 'active';
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-password');

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Get admin users error:', error);
    throw error;
  }
}));

// @route   POST /api/admin/users
// @desc    Create a new user (Admin only)
// @access  Private (Super Admin)
router.post('/users', authenticateSuperAdmin, validateRequest(adminSchemas.createUser), asyncHandler(async (req, res) => {
  const userData = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: userData.email }, { username: userData.username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }

    // Create new user
    const user = new User(userData);
    await user.save();

    // Clear user cache
    await cache.del(`users:${JSON.stringify({ role: userData.role })}`);

    // Log user creation
    logger.info(`Admin ${req.user.username} created new user: ${user.username}`);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user.getPublicProfile()
    });
  } catch (error) {
    logger.error('Create admin user error:', error);
    throw error;
  }
}));

// @route   PUT /api/admin/users/:id
// @desc    Update user (Admin only)
// @access  Private (Admin)
router.put('/users/:id', validateRequest(adminSchemas.updateUser), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  try {
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if admin is trying to change role to admin (only super admin can do this)
    if (updateData.role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can assign admin role'
      });
    }

    // Update user
    Object.assign(user, updateData);
    await user.save();

    // Clear user cache
    await cache.del(`users:${JSON.stringify({ role: user.role })}`);

    // Log user update
    logger.info(`Admin ${req.user.username} updated user: ${user.username}`);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user.getPublicProfile()
    });
  } catch (error) {
    logger.error(`Update admin user ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   DELETE /api/admin/users/:id
// @desc    Delete user (Admin only)
// @access  Private (Super Admin)
router.delete('/users/:id', authenticateSuperAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is trying to delete themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Check if user has active contests or pending transactions
    // TODO: Add checks for active contests, pending transactions, etc.
    
    // Deactivate user instead of deleting
    user.isActive = false;
    await user.save();

    // Clear user cache
    await cache.del(`users:${JSON.stringify({ role: user.role })}`);

    // Log user deactivation
    logger.info(`Super admin ${req.user.username} deactivated user: ${user.username}`);

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    logger.error(`Delete admin user ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   POST /api/admin/users/:id/activate
// @desc    Activate user (Admin only)
// @access  Private (Admin)
router.post('/users/:id/activate', asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = true;
    await user.save();

    // Clear user cache
    await cache.del(`users:${JSON.stringify({ role: user.role })}`);

    // Log user activation
    logger.info(`Admin ${req.user.username} activated user: ${user.username}`);

    res.json({
      success: true,
      message: 'User activated successfully'
    });
  } catch (error) {
    logger.error(`Activate admin user ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   GET /api/admin/matches
// @desc    Get all matches with admin filters
// @access  Private (Admin)
router.get('/matches', asyncHandler(async (req, res) => {
  const {
    sport,
    status,
    page = 1,
    limit = 20
  } = req.query;

  try {
    const filter = {};
    
    if (sport) filter.sport = sport;
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const matches = await Match.find(filter)
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Match.countDocuments(filter);

    res.json({
      success: true,
      data: {
        matches,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Get admin matches error:', error);
    throw error;
  }
}));

// @route   POST /api/admin/matches
// @desc    Create a new match (Admin only)
// @access  Private (Admin)
router.post('/matches', validateRequest(adminSchemas.createMatch), asyncHandler(async (req, res) => {
  const matchData = req.body;

  try {
    // Check if match already exists
    const existingMatch = await Match.findOne({ externalId: matchData.externalId });
    if (existingMatch) {
      return res.status(400).json({
        success: false,
        message: 'Match with this external ID already exists'
      });
    }

    // Create new match
    const match = new Match(matchData);
    await match.save();

    // Clear match cache
    await cache.del(`matches:${JSON.stringify({ sport: matchData.sport })}`);

    // Log match creation
    logger.info(`Admin ${req.user.username} created new match: ${match.title}`);

    res.status(201).json({
      success: true,
      message: 'Match created successfully',
      data: match
    });
  } catch (error) {
    logger.error('Create admin match error:', error);
    throw error;
  }
}));

// @route   PUT /api/admin/matches/:id
// @desc    Update match (Admin only)
// @access  Private (Admin)
router.put('/matches/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  try {
    const match = await Match.findById(id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    // Update match
    Object.assign(match, updateData);
    await match.save();

    // Clear match cache
    await cache.del(`match:${id}`);
    await cache.del(`matches:${JSON.stringify({ sport: match.sport })}`);

    // Log match update
    logger.info(`Admin ${req.user.username} updated match: ${match.title}`);

    res.json({
      success: true,
      message: 'Match updated successfully',
      data: match
    });
  } catch (error) {
    logger.error(`Update admin match ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   GET /api/admin/contests
// @desc    Get all contests with admin filters
// @access  Private (Admin)
router.get('/contests', asyncHandler(async (req, res) => {
  const {
    sport,
    status,
    contestType,
    page = 1,
    limit = 20
  } = req.query;

  try {
    const filter = {};
    
    if (sport) filter.sport = sport;
    if (status) filter.status = status;
    if (contestType) filter.contestType = contestType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const contests = await Contest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('matchId', 'title sport startTime');

    const total = await Contest.countDocuments(filter);

    res.json({
      success: true,
      data: {
        contests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Get admin contests error:', error);
    throw error;
  }
}));

// @route   GET /api/admin/transactions
// @desc    Get all transactions with admin filters
// @access  Private (Admin)
router.get('/transactions', asyncHandler(async (req, res) => {
  const {
    type,
    status,
    page = 1,
    limit = 20,
    startDate,
    endDate
  } = req.query;

  try {
    const filter = {};
    
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'username email');

    const total = await Transaction.countDocuments(filter);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Get admin transactions error:', error);
    throw error;
  }
}));

// @route   POST /api/admin/transactions/:id/approve
// @desc    Approve transaction (Admin only)
// @access  Private (Admin)
router.post('/transactions/:id/approve', asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const transaction = await Transaction.findById(id);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Transaction is not pending'
      });
    }

    // Process transaction
    await transaction.process();

    // Update user wallet if needed
    if (transaction.type === 'withdrawal') {
      const user = await User.findById(transaction.userId);
      if (user) {
        // Withdrawal already deducted when requested
        // Just mark as completed
        transaction.balanceAfter = user.wallet.balance;
        await transaction.save();
      }
    }

    // Log transaction approval
    logger.info(`Admin ${req.user.username} approved transaction: ${transaction.reference}`);

    res.json({
      success: true,
      message: 'Transaction approved successfully',
      data: transaction
    });
  } catch (error) {
    logger.error(`Approve admin transaction ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   POST /api/admin/transactions/:id/reject
// @desc    Reject transaction (Admin only)
// @access  Private (Admin)
router.post('/transactions/:id/reject', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({
      success: false,
      message: 'Rejection reason is required'
    });
  }

  try {
    const transaction = await Transaction.findById(id);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Transaction is not pending'
      });
    }

    // Reject transaction
    transaction.status = 'failed';
    transaction.failureReason = reason;
    await transaction.save();

    // Reverse wallet changes if needed
    if (transaction.type === 'withdrawal') {
      const user = await User.findById(transaction.userId);
      if (user) {
        user.wallet.balance += Math.abs(transaction.amount);
        user.wallet.totalWithdrawn -= Math.abs(transaction.amount);
        await user.save();
      }
    }

    // Log transaction rejection
    logger.info(`Admin ${req.user.username} rejected transaction: ${transaction.reference}`);

    res.json({
      success: true,
      message: 'Transaction rejected successfully',
      data: transaction
    });
  } catch (error) {
    logger.error(`Reject admin transaction ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   GET /api/admin/analytics
// @desc    Get platform analytics
// @access  Private (Admin)
router.get('/analytics', asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;

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

    // Get user registration analytics
    const userRegistrations = await User.aggregate([
      {
        $match: { createdAt: { $gte: startDate } }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get transaction analytics
    const transactionAnalytics = await Transaction.aggregate([
      {
        $match: { createdAt: { $gte: startDate } }
      },
      {
        $group: {
          _id: { type: '$type', date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);

    // Get contest analytics
    const contestAnalytics = await Contest.aggregate([
      {
        $match: { createdAt: { $gte: startDate } }
      },
      {
        $group: {
          _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } },
          count: { $sum: 1 },
          totalPrizePool: { $sum: '$prizePool' },
          totalParticipants: { $sum: '$statistics.totalParticipants' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const analytics = {
      period,
      userRegistrations,
      transactionAnalytics,
      contestAnalytics
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error('Get admin analytics error:', error);
    throw error;
  }
}));

// @route   POST /api/admin/system/announcement
// @desc    Send system announcement (Admin only)
// @access  Private (Admin)
router.post('/system/announcement', asyncHandler(async (req, res) => {
  const { title, message, type = 'info', targetUsers = 'all' } = req.body;

  if (!title || !message) {
    return res.status(400).json({
      success: false,
      message: 'Title and message are required'
    });
  }

  try {
    // TODO: Implement announcement system
    // For now, just log the announcement
    
    // Log announcement
    logger.info(`Admin ${req.user.username} sent system announcement: ${title}`);

    res.json({
      success: true,
      message: 'Announcement sent successfully'
    });
  } catch (error) {
    logger.error('Send system announcement error:', error);
    throw error;
  }
}));

// @route   POST /api/admin/system/maintenance
// @desc    Toggle system maintenance mode (Super Admin only)
// @access  Private (Super Admin)
router.post('/system/maintenance', authenticateSuperAdmin, asyncHandler(async (req, res) => {
  const { enabled, reason } = req.body;

  try {
    // TODO: Implement maintenance mode system
    // For now, just log the action
    
    // Log maintenance mode change
    logger.info(`Super admin ${req.user.username} ${enabled ? 'enabled' : 'disabled'} maintenance mode: ${reason || 'No reason provided'}`);

    res.json({
      success: true,
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    logger.error('Toggle maintenance mode error:', error);
    throw error;
  }
}));

module.exports = router;
