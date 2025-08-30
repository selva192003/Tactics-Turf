const express = require('express');
const Match = require('../../models/Match');
const { authenticateToken, optionalAuth } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');
const { cache } = require('../../services/redis');
const logger = require('../../services/logger');

const router = express.Router();

// @route   GET /api/matches
// @desc    Get all matches with filters
// @access  Public
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const {
    sport,
    status,
    tournament,
    team,
    startDate,
    endDate,
    page = 1,
    limit = 20,
    sortBy = 'startTime',
    sortOrder = 'asc'
  } = req.query;

  try {
    // Build filter object
    const filter = {};
    
    if (sport) filter.sport = sport;
    if (status) filter.status = status;
    if (tournament) filter.tournament = { $regex: tournament, $options: 'i' };
    if (team) {
      filter.$or = [
        { 'team1.name': { $regex: team, $options: 'i' } },
        { 'team2.name': { $regex: team, $options: 'i' } }
      ];
    }
    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) filter.startTime.$gte = new Date(startDate);
      if (endDate) filter.startTime.$lte = new Date(endDate);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Check cache first
    const cacheKey = `matches:${JSON.stringify(filter)}:${page}:${limit}:${sortBy}:${sortOrder}`;
    const cachedData = await cache.get(cacheKey);
    
    if (cachedData) {
      return res.json({
        success: true,
        data: cachedData
      });
    }

    // Execute query
    const matches = await Match.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-highlights -streamingUrl');

    const total = await Match.countDocuments(filter);

    const result = {
      matches,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    };

    // Cache the result for 5 minutes
    await cache.set(cacheKey, result, 300);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get matches error:', error);
    throw error;
  }
}));

// @route   GET /api/matches/upcoming
// @desc    Get upcoming matches
// @access  Public
router.get('/upcoming', optionalAuth, asyncHandler(async (req, res) => {
  const { sport, limit = 10 } = req.query;

  try {
    const filter = {
      status: 'upcoming',
      startTime: { $gt: new Date() }
    };

    if (sport) filter.sport = sport;

    const matches = await Match.find(filter)
      .sort({ startTime: 1 })
      .limit(parseInt(limit))
      .select('title sport tournament team1 team2 startTime venue matchFormat');

    res.json({
      success: true,
      data: matches
    });
  } catch (error) {
    logger.error('Get upcoming matches error:', error);
    throw error;
  }
}));

// @route   GET /api/matches/live
// @desc    Get live matches
// @access  Public
router.get('/live', optionalAuth, asyncHandler(async (req, res) => {
  try {
    const matches = await Match.find({
      status: 'live'
    })
    .sort({ startTime: 1 })
    .select('title sport tournament team1 team2 startTime currentScore status');

    res.json({
      success: true,
      data: matches
    });
  } catch (error) {
    logger.error('Get live matches error:', error);
    throw error;
  }
}));

// @route   GET /api/matches/:id
// @desc    Get match by ID
// @access  Public
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    // Check cache first
    const cacheKey = `match:${id}`;
    const cachedMatch = await cache.get(cacheKey);
    
    if (cachedMatch) {
      return res.json({
        success: true,
        data: cachedMatch
      });
    }

    const match = await Match.findById(id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    // Cache the match for 2 minutes
    await cache.set(cacheKey, match, 120);

    res.json({
      success: true,
      data: match
    });
  } catch (error) {
    logger.error(`Get match ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   GET /api/matches/:id/contests
// @desc    Get contests for a specific match
// @access  Public
router.get('/:id/contests', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 20, contestType, entryFee } = req.query;

  try {
    // Verify match exists
    const match = await Match.findById(id);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    // Import Contest model here to avoid circular dependency
    const Contest = require('../../models/Contest');
    
    // Build filter
    const filter = { matchId: id, isActive: true, isVisible: true };
    if (contestType) filter.contestType = contestType;
    if (entryFee) filter.entryFee = { $lte: parseInt(entryFee) };

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const contests = await Contest.find(filter)
      .sort({ entryFee: 1, totalSpots: 1 })
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
    logger.error(`Get contests for match ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   GET /api/matches/:id/players
// @desc    Get players for a specific match
// @access  Public
router.get('/:id/players', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, team, search } = req.query;

  try {
    // Verify match exists
    const match = await Match.findById(id);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    // Import Player model here to avoid circular dependency
    const Player = require('../../models/Player');
    
    // Build filter
    const filter = { sport: match.sport, isActive: true };
    
    if (role) filter.role = role;
    if (team) filter['team.name'] = { $regex: team, $options: 'i' };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'team.name': { $regex: search, $options: 'i' } }
      ];
    }

    const players = await Player.find(filter)
      .sort({ popularity: -1, fantasyPoints: { average: -1 } })
      .select('name shortName role team avatar price popularity fantasyPoints');

    res.json({
      success: true,
      data: players
    });
  } catch (error) {
    logger.error(`Get players for match ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   GET /api/matches/:id/scorecard
// @desc    Get live scorecard for a match
// @access  Public
router.get('/:id/scorecard', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const match = await Match.findById(id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    if (match.status === 'upcoming') {
      return res.status(400).json({
        success: false,
        message: 'Match has not started yet'
      });
    }

    // Get detailed scorecard based on sport
    let scorecard = {
      matchId: match._id,
      title: match.title,
      sport: match.sport,
      status: match.status,
      currentScore: match.currentScore,
      startTime: match.startTime,
      lastUpdated: match.updatedAt
    };

    if (match.sport === 'cricket') {
      scorecard.innings = [
        {
          team: match.team1.name,
          score: match.currentScore.team1.runs,
          wickets: match.currentScore.team1.wickets,
          overs: match.currentScore.team1.overs
        },
        {
          team: match.team2.name,
          score: match.currentScore.team2.runs,
          wickets: match.currentScore.team2.wickets,
          overs: match.currentScore.team2.overs
        }
      ];
    } else if (match.sport === 'football') {
      scorecard.score = {
        [match.team1.name]: match.currentScore.team1.runs || 0,
        [match.team2.name]: match.currentScore.team2.runs || 0
      };
    }

    res.json({
      success: true,
      data: scorecard
    });
  } catch (error) {
    logger.error(`Get scorecard for match ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   GET /api/matches/:id/highlights
// @desc    Get match highlights
// @access  Public
router.get('/:id/highlights', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const match = await Match.findById(id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    if (!match.isHighlightsEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Highlights are not available for this match'
      });
    }

    res.json({
      success: true,
      data: {
        matchId: match._id,
        title: match.title,
        highlights: match.highlights || []
      }
    });
  } catch (error) {
    logger.error(`Get highlights for match ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   GET /api/matches/sports/:sport
// @desc    Get matches by sport
// @access  Public
router.get('/sports/:sport', optionalAuth, asyncHandler(async (req, res) => {
  const { sport } = req.params;
  const { status, page = 1, limit = 20 } = req.query;

  try {
    const filter = { sport };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const matches = await Match.find(filter)
      .sort({ startTime: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('title tournament team1 team2 startTime status venue');

    const total = await Match.countDocuments(filter);

    res.json({
      success: true,
      data: {
        sport,
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
    logger.error(`Get matches by sport ${req.params.sport} error:`, error);
    throw error;
  }
}));

// @route   GET /api/matches/tournaments/:tournament
// @desc    Get matches by tournament
// @access  Public
router.get('/tournaments/:tournament', optionalAuth, asyncHandler(async (req, res) => {
  const { tournament } = req.params;
  const { page = 1, limit = 20 } = req.query;

  try {
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const matches = await Match.find({
      tournament: { $regex: tournament, $options: 'i' }
    })
    .sort({ startTime: 1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select('title sport team1 team2 startTime status venue');

    const total = await Match.countDocuments({
      tournament: { $regex: tournament, $options: 'i' }
    });

    res.json({
      success: true,
      data: {
        tournament,
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
    logger.error(`Get matches by tournament ${req.params.tournament} error:`, error);
    throw error;
  }
}));

// @route   GET /api/matches/search
// @desc    Search matches
// @access  Public
router.get('/search', optionalAuth, asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;

  if (!q) {
    return res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
  }

  try {
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const matches = await Match.find({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { tournament: { $regex: q, $options: 'i' } },
        { 'team1.name': { $regex: q, $options: 'i' } },
        { 'team2.name': { $regex: q, $options: 'i' } }
      ]
    })
    .sort({ startTime: 1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select('title sport tournament team1 team2 startTime status venue');

    const total = await Match.countDocuments({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { tournament: { $regex: q, $options: 'i' } },
        { 'team1.name': { $regex: q, $options: 'i' } },
        { 'team2.name': { $regex: q, $options: 'i' } }
      ]
    });

    res.json({
      success: true,
      data: {
        query: q,
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
    logger.error('Search matches error:', error);
    throw error;
  }
}));

module.exports = router;