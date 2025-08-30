const express = require('express');
const Contest = require('../../models/Contest');
const Match = require('../../models/Match');
const { authenticateToken, optionalAuth } = require('../../middleware/auth');
const { validateRequest, contestSchemas } = require('../../middleware/validation');
const { asyncHandler } = require('../../middleware/errorHandler');
const { cache } = require('../../services/redis');
const { events } = require('../../services/websocket');
const logger = require('../../services/logger');

const router = express.Router();

// @route   GET /api/contests
// @desc    Get all contests with filters
// @access  Public
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const {
    sport,
    contestType,
    status,
    entryFee,
    prizePool,
    page = 1,
    limit = 20,
    sortBy = 'startTime',
    sortOrder = 'asc'
  } = req.query;

  try {
    // Build filter object
    const filter = { isActive: true, isVisible: true };
    
    if (sport) filter.sport = sport;
    if (contestType) filter.contestType = contestType;
    if (status) filter.status = status;
    if (entryFee) filter.entryFee = { $lte: parseInt(entryFee) };
    if (prizePool) filter.prizePool = { $gte: parseInt(prizePool) };

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Check cache first
    const cacheKey = `contests:${JSON.stringify(filter)}:${page}:${limit}:${sortBy}:${sortOrder}`;
    const cachedData = await cache.get(cacheKey);
    
    if (cachedData) {
      return res.json({
        success: true,
        data: cachedData
      });
    }

    // Execute query
    const contests = await Contest.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('matchId', 'title sport startTime team1 team2');

    const total = await Contest.countDocuments(filter);

    const result = {
      contests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    };

    // Cache the result for 3 minutes
    await cache.set(cacheKey, result, 180);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get contests error:', error);
    throw error;
  }
}));

// @route   GET /api/contests/featured
// @desc    Get featured contests
// @access  Public
router.get('/featured', optionalAuth, asyncHandler(async (req, res) => {
  try {
    const contests = await Contest.find({
      featured: true,
      isActive: true,
      isVisible: true
    })
    .sort({ priority: -1, startTime: 1 })
    .limit(10)
    .populate('matchId', 'title sport startTime team1 team2');

    res.json({
      success: true,
      data: contests
    });
  } catch (error) {
    logger.error('Get featured contests error:', error);
    throw error;
  }
}));

// @route   GET /api/contests/:id
// @desc    Get contest by ID
// @access  Public
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    // Check cache first
    const cacheKey = `contest:${id}`;
    const cachedContest = await cache.get(cacheKey);
    
    if (cachedContest) {
      return res.json({
        success: true,
        data: cachedContest
      });
    }

    const contest = await Contest.findById(id)
      .populate('matchId', 'title sport startTime team1 team2 venue')
      .populate('participants.userId', 'username fullName avatar');
    
    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found'
      });
    }

    // Cache the contest for 2 minutes
    await cache.set(cacheKey, contest, 120);

    res.json({
      success: true,
      data: contest
    });
  } catch (error) {
    logger.error(`Get contest ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   GET /api/contests/:id/leaderboard
// @desc    Get contest leaderboard
// @access  Public
router.get('/:id/leaderboard', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;

  try {
    const contest = await Contest.findById(id);
    
    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found'
      });
    }

    // Check cache first
    const cacheKey = `contest:${id}:leaderboard:${page}:${limit}`;
    const cachedLeaderboard = await cache.get(cacheKey);
    
    if (cachedLeaderboard) {
      return res.json({
        success: true,
        data: cachedLeaderboard
      });
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get leaderboard from contest
    const leaderboard = contest.leaderboard.slice(skip, skip + parseInt(limit));
    const total = contest.leaderboard.length;

    const result = {
      contestId: contest._id,
      contestName: contest.name,
      leaderboard,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    };

    // Cache the leaderboard for 1 minute (frequently updated)
    await cache.set(cacheKey, result, 60);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`Get contest ${req.params.id} leaderboard error:`, error);
    throw error;
  }
}));

// @route   POST /api/contests
// @desc    Create a new contest
// @access  Private (Admin/Moderator)
router.post('/', authenticateToken, validateRequest(contestSchemas.create), asyncHandler(async (req, res) => {
  const contestData = req.body;

  try {
    // Check if user has permission to create contests
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to create contests'
      });
    }

    // Verify match exists
    const match = await Match.findById(contestData.matchId);
    if (!match) {
      return res.status(400).json({
        success: false,
        message: 'Match not found'
      });
    }

    // Create contest
    const contest = new Contest({
      ...contestData,
      createdBy: req.user._id,
      sport: match.sport
    });

    await contest.save();

    // Clear related caches
    await cache.del(`contests:${JSON.stringify({ sport: match.sport })}`);
    await cache.del(`match:${contestData.matchId}:contests`);

    // Log contest creation
    logger.info(`Contest created: ${contest.name} by ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: 'Contest created successfully',
      data: contest
    });
  } catch (error) {
    logger.error('Create contest error:', error);
    throw error;
  }
}));

// @route   PUT /api/contests/:id
// @desc    Update contest
// @access  Private (Admin/Moderator)
router.put('/:id', authenticateToken, validateRequest(contestSchemas.update), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  try {
    // Check if user has permission to update contests
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to update contests'
      });
    }

    const contest = await Contest.findById(id);
    
    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found'
      });
    }

    // Update contest
    Object.assign(contest, updateData);
    await contest.save();

    // Clear related caches
    await cache.del(`contest:${id}`);
    await cache.del(`contests:${JSON.stringify({ sport: contest.sport })}`);
    await cache.del(`match:${contest.matchId}:contests`);

    // Emit contest update event
    events.contestUpdate(id, {
      type: 'update',
      contest: contest.getSummary()
    });

    // Log contest update
    logger.info(`Contest updated: ${contest.name} by ${req.user.username}`);

    res.json({
      success: true,
      message: 'Contest updated successfully',
      data: contest
    });
  } catch (error) {
    logger.error(`Update contest ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   DELETE /api/contests/:id
// @desc    Delete contest
// @access  Private (Admin/Moderator)
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    // Check if user has permission to delete contests
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to delete contests'
      });
    }

    const contest = await Contest.findById(id);
    
    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found'
      });
    }

    // Check if contest has participants
    if (contest.participants.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete contest with participants'
      });
    }

    await Contest.findByIdAndDelete(id);

    // Clear related caches
    await cache.del(`contest:${id}`);
    await cache.del(`contests:${JSON.stringify({ sport: contest.sport })}`);
    await cache.del(`match:${contest.matchId}:contests`);

    // Log contest deletion
    logger.info(`Contest deleted: ${contest.name} by ${req.user.username}`);

    res.json({
      success: true,
      message: 'Contest deleted successfully'
    });
  } catch (error) {
    logger.error(`Delete contest ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   POST /api/contests/:id/join
// @desc    Join a contest
// @access  Private
router.post('/:id/join', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { teamId } = req.body;

  if (!teamId) {
    return res.status(400).json({
      success: false,
      message: 'Team ID is required'
    });
  }

  try {
    const contest = await Contest.findById(id);
    
    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found'
      });
    }

    // Check if contest is active and registration is open
    if (!contest.isActive || !contest.isVisible) {
      return res.status(400).json({
        success: false,
        message: 'Contest is not available for registration'
      });
    }

    if (!contest.isRegistrationOpen) {
      return res.status(400).json({
        success: false,
        message: 'Contest registration is closed'
      });
    }

    // Check if user has sufficient balance
    const user = await require('../../models/User').findById(req.user._id);
    if (user.wallet.balance < contest.entryFee) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance'
      });
    }

    // Check if user already joined (for single entry contests)
    if (contest.entryType === 'single') {
      const existingParticipant = contest.participants.find(
        p => p.userId.toString() === req.user._id.toString()
      );
      
      if (existingParticipant) {
        return res.status(400).json({
          success: false,
          message: 'You have already joined this contest'
        });
      }
    }

    // Add participant to contest
    await contest.addParticipant(req.user._id, teamId);

    // Deduct entry fee from user wallet
    user.wallet.balance -= contest.entryFee;
    await user.save();

    // Create transaction record
    const Transaction = require('../../models/Transaction');
    await Transaction.createContestEntry(
      req.user._id,
      contest.entryFee,
      contest._id,
      contest.matchId,
      teamId
    );

    // Clear related caches
    await cache.del(`contest:${id}`);
    await cache.del(`contest:${id}:leaderboard`);

    // Emit contest update event
    events.contestUpdate(id, {
      type: 'participant_joined',
      participant: {
        userId: req.user._id,
        username: req.user.username
      },
      totalParticipants: contest.participants.length
    });

    // Log contest join
    logger.info(`User ${req.user.username} joined contest: ${contest.name}`);

    res.json({
      success: true,
      message: 'Successfully joined contest',
      data: {
        contestId: contest._id,
        contestName: contest.name,
        entryFee: contest.entryFee,
        totalParticipants: contest.participants.length
      }
    });
  } catch (error) {
    logger.error(`Join contest ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   POST /api/contests/:id/leave
// @desc    Leave a contest
// @access  Private
router.post('/:id/leave', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const contest = await Contest.findById(id);
    
    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found'
      });
    }

    // Check if contest allows leaving
    if (contest.status !== 'upcoming') {
      return res.status(400).json({
        success: false,
        message: 'Cannot leave contest after it has started'
      });
    }

    // Check if user is a participant
    const participant = contest.participants.find(
      p => p.userId.toString() === req.user._id.toString()
    );
    
    if (!participant) {
      return res.status(400).json({
        success: false,
        message: 'You are not a participant in this contest'
      });
    }

    // Remove participant from contest
    await contest.removeParticipant(req.user._id);

    // Refund entry fee to user wallet
    const user = await require('../../models/User').findById(req.user._id);
    user.wallet.balance += contest.entryFee;
    await user.save();

    // Create refund transaction
    const Transaction = require('../../models/Transaction');
    await Transaction.createRefund(
      req.user._id,
      contest.entryFee,
      contest._id,
      contest.matchId,
      participant.teamId
    );

    // Clear related caches
    await cache.del(`contest:${id}`);
    await cache.del(`contest:${id}:leaderboard`);

    // Emit contest update event
    events.contestUpdate(id, {
      type: 'participant_left',
      participant: {
        userId: req.user._id,
        username: req.user.username
      },
      totalParticipants: contest.participants.length
    });

    // Log contest leave
    logger.info(`User ${req.user.username} left contest: ${contest.name}`);

    res.json({
      success: true,
      message: 'Successfully left contest',
      data: {
        contestId: contest._id,
        contestName: contest.name,
        refundAmount: contest.entryFee,
        totalParticipants: contest.participants.length
      }
    });
  } catch (error) {
    logger.error(`Leave contest ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   GET /api/contests/user/joined
// @desc    Get contests joined by user
// @access  Private
router.get('/user/joined', authenticateToken, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;

  try {
    const filter = { 'participants.userId': req.user._id };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const contests = await Contest.find(filter)
      .sort({ startTime: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('matchId', 'title sport startTime team1 team2')
      .select('name contestType entryFee prizePool status startTime participants');

    const total = await Contest.countDocuments(filter);

    // Add user's rank and points to each contest
    const contestsWithUserData = contests.map(contest => {
      const participant = contest.participants.find(
        p => p.userId.toString() === req.user._id.toString()
      );
      
      return {
        ...contest.toObject(),
        userRank: participant?.rank || null,
        userPoints: participant?.points || 0,
        userPrize: participant?.prize || 0
      };
    });

    res.json({
      success: true,
      data: {
        contests: contestsWithUserData,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Get user joined contests error:', error);
    throw error;
  }
}));

module.exports = router;
