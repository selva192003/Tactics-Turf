const express = require('express');
const Player = require('../../models/Player');
const { authenticateToken, optionalAuth } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');
const { cache } = require('../../services/redis');
const logger = require('../../services/logger');

const router = express.Router();

// @route   GET /api/players
// @desc    Get all players with filters
// @access  Public
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const {
    sport,
    role,
    team,
    search,
    page = 1,
    limit = 50,
    sortBy = 'popularity',
    sortOrder = 'desc'
  } = req.query;

  try {
    // Build filter object
    const filter = { isActive: true };
    
    if (sport) filter.sport = sport;
    if (role) filter.role = role;
    if (team) filter['team.name'] = { $regex: team, $options: 'i' };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'team.name': { $regex: search, $options: 'i' } },
        { role: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Check cache first
    const cacheKey = `players:${JSON.stringify(filter)}:${page}:${limit}:${sortBy}:${sortOrder}`;
    const cachedData = await cache.get(cacheKey);
    
    if (cachedData) {
      return res.json({
        success: true,
        data: cachedData
      });
    }

    // Execute query
    const players = await Player.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('name shortName role team avatar price popularity fantasyPoints stats');

    const total = await Player.countDocuments(filter);

    const result = {
      players,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    };

    // Cache the result for 10 minutes
    await cache.set(cacheKey, result, 600);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get players error:', error);
    throw error;
  }
}));

// @route   GET /api/players/:id
// @desc    Get player by ID
// @access  Public
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    // Check cache first
    const cacheKey = `player:${id}`;
    const cachedPlayer = await cache.get(cacheKey);
    
    if (cachedPlayer) {
      return res.json({
        success: true,
        data: cachedPlayer
      });
    }

    const player = await Player.findById(id);
    
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    // Cache the player for 30 minutes
    await cache.set(cacheKey, player, 1800);

    res.json({
      success: true,
      data: player
    });
  } catch (error) {
    logger.error(`Get player ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   GET /api/players/sport/:sport
// @desc    Get players by sport
// @access  Public
router.get('/sport/:sport', optionalAuth, asyncHandler(async (req, res) => {
  const { sport } = req.params;
  const { role, team, page = 1, limit = 50 } = req.query;

  try {
    const filter = { sport, isActive: true };
    
    if (role) filter.role = role;
    if (team) filter['team.name'] = { $regex: team, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const players = await Player.find(filter)
      .sort({ popularity: -1, fantasyPoints: { average: -1 } })
      .skip(skip)
      .limit(parseInt(limit))
      .select('name shortName role team avatar price popularity fantasyPoints');

    const total = await Player.countDocuments(filter);

    res.json({
      success: true,
      data: {
        sport,
        players,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error(`Get players by sport ${req.params.sport} error:`, error);
    throw error;
  }
}));

// @route   GET /api/players/team/:teamName
// @desc    Get players by team
// @access  Public
router.get('/team/:teamName', optionalAuth, asyncHandler(async (req, res) => {
  const { teamName } = req.params;
  const { sport, role, page = 1, limit = 50 } = req.query;

  try {
    const filter = { 'team.name': { $regex: teamName, $options: 'i' }, isActive: true };
    
    if (sport) filter.sport = sport;
    if (role) filter.role = role;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const players = await Player.find(filter)
      .sort({ role: 1, popularity: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('name shortName role team avatar price popularity fantasyPoints');

    const total = await Player.countDocuments(filter);

    res.json({
      success: true,
      data: {
        team: teamName,
        players,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error(`Get players by team ${req.params.teamName} error:`, error);
    throw error;
  }
}));

// @route   GET /api/players/role/:role
// @desc    Get players by role
// @access  Public
router.get('/role/:role', optionalAuth, asyncHandler(async (req, res) => {
  const { role } = req.params;
  const { sport, team, page = 1, limit = 50 } = req.query;

  try {
    const filter = { role, isActive: true };
    
    if (sport) filter.sport = sport;
    if (team) filter['team.name'] = { $regex: team, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const players = await Player.find(filter)
      .sort({ fantasyPoints: { average: -1 }, popularity: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('name shortName role team avatar price popularity fantasyPoints');

    const total = await Player.countDocuments(filter);

    res.json({
      success: true,
      data: {
        role,
        players,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error(`Get players by role ${req.params.role} error:`, error);
    throw error;
  }
}));

// @route   GET /api/players/search
// @desc    Search players
// @access  Public
router.get('/search', optionalAuth, asyncHandler(async (req, res) => {
  const { q, sport, role, team, page = 1, limit = 50 } = req.query;

  if (!q) {
    return res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
  }

  try {
    const filter = {
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { shortName: { $regex: q, $options: 'i' } },
        { 'team.name': { $regex: q, $options: 'i' } }
      ],
      isActive: true
    };
    
    if (sport) filter.sport = sport;
    if (role) filter.role = role;
    if (team) filter['team.name'] = { $regex: team, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const players = await Player.find(filter)
      .sort({ popularity: -1, fantasyPoints: { average: -1 } })
      .skip(skip)
      .limit(parseInt(limit))
      .select('name shortName role team avatar price popularity fantasyPoints');

    const total = await Player.countDocuments(filter);

    res.json({
      success: true,
      data: {
        query: q,
        players,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Search players error:', error);
    throw error;
  }
}));

// @route   GET /api/players/popular
// @desc    Get popular players
// @access  Public
router.get('/popular', optionalAuth, asyncHandler(async (req, res) => {
  const { sport, role, limit = 20 } = req.query;

  try {
    const filter = { isActive: true };
    
    if (sport) filter.sport = sport;
    if (role) filter.role = role;

    const players = await Player.find(filter)
      .sort({ popularity: -1, fantasyPoints: { average: -1 } })
      .limit(parseInt(limit))
      .select('name shortName role team avatar price popularity fantasyPoints');

    res.json({
      success: true,
      data: players
    });
  } catch (error) {
    logger.error('Get popular players error:', error);
    throw error;
  }
}));

// @route   GET /api/players/trending
// @desc    Get trending players (based on recent form)
// @access  Public
router.get('/trending', optionalAuth, asyncHandler(async (req, res) => {
  const { sport, limit = 20 } = req.query;

  try {
    const filter = { isActive: true };
    
    if (sport) filter.sport = sport;

    const players = await Player.find(filter)
      .sort({ 'fantasyPoints.average': -1, 'fantasyPoints.best': -1 })
      .limit(parseInt(limit))
      .select('name shortName role team avatar price popularity fantasyPoints recentForm');

    res.json({
      success: true,
      data: players
    });
  } catch (error) {
    logger.error('Get trending players error:', error);
    throw error;
  }
}));

// @route   GET /api/players/:id/stats
// @desc    Get detailed player statistics
// @access  Public
router.get('/:id/stats', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const player = await Player.findById(id);
    
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    const stats = player.getDetailedStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error(`Get player ${req.params.id} stats error:`, error);
    throw error;
  }
}));

// @route   GET /api/players/:id/form
// @desc    Get player's recent form
// @access  Public
router.get('/:id/form', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 10 } = req.query;

  try {
    const player = await Player.findById(id);
    
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    const recentForm = player.recentForm
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      data: {
        playerId: player._id,
        playerName: player.name,
        recentForm
      }
    });
  } catch (error) {
    logger.error(`Get player ${req.params.id} form error:`, error);
    throw error;
  }
}));

// @route   GET /api/players/compare
// @desc    Compare multiple players
// @access  Public
router.get('/compare', optionalAuth, asyncHandler(async (req, res) => {
  const { players } = req.query;

  if (!players) {
    return res.status(400).json({
      success: false,
      message: 'Player IDs are required'
    });
  }

  try {
    const playerIds = players.split(',');
    
    if (playerIds.length < 2 || playerIds.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Please select 2-5 players to compare'
      });
    }

    const playersData = await Player.find({
      _id: { $in: playerIds },
      isActive: true
    }).select('name shortName role team avatar price popularity fantasyPoints stats');

    if (playersData.length !== playerIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some players not found'
      });
    }

    // Ensure all players are from the same sport for fair comparison
    const sport = playersData[0].sport;
    const sameSport = playersData.every(player => player.sport === sport);
    
    if (!sameSport) {
      return res.status(400).json({
        success: false,
        message: 'Cannot compare players from different sports'
      });
    }

    res.json({
      success: true,
      data: {
        sport,
        players: playersData
      }
    });
  } catch (error) {
    logger.error('Compare players error:', error);
    throw error;
  }
}));

// @route   GET /api/players/suggestions
// @desc    Get player suggestions for team building
// @access  Private
router.get('/suggestions', authenticateToken, asyncHandler(async (req, res) => {
  const { sport, role, budget, exclude } = req.query;

  if (!sport || !role || !budget) {
    return res.status(400).json({
      success: false,
      message: 'Sport, role, and budget are required'
    });
  }

  try {
    const filter = {
      sport,
      role,
      isActive: true,
      price: { $lte: parseInt(budget) }
    };

    if (exclude) {
      const excludeIds = exclude.split(',');
      filter._id = { $nin: excludeIds };
    }

    const suggestions = await Player.find(filter)
      .sort({ fantasyPoints: { average: -1 }, popularity: -1 })
      .limit(10)
      .select('name shortName role team avatar price popularity fantasyPoints');

    res.json({
      success: true,
      data: {
        sport,
        role,
        budget: parseInt(budget),
        suggestions
      }
    });
  } catch (error) {
    logger.error('Get player suggestions error:', error);
    throw error;
  }
}));

module.exports = router;
