const express = require('express');
const FantasyTeam = require('../../models/FantasyTeam');
const Match = require('../../models/Match');
const Player = require('../../models/Player');
const { authenticateToken } = require('../../middleware/auth');
const { validateRequest, teamSchemas } = require('../../middleware/validation');
const { asyncHandler } = require('../../middleware/errorHandler');
const { cache } = require('../../services/redis');
const { events } = require('../../services/websocket');
const logger = require('../../services/logger');

const router = express.Router();

// @route   GET /api/teams
// @desc    Get user's fantasy teams
// @access  Private
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { matchId, status, page = 1, limit = 20 } = req.query;

  try {
    const filter = { userId: req.user._id };
    
    if (matchId) filter.matchId = matchId;
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const teams = await FantasyTeam.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('matchId', 'title sport startTime team1 team2');

    const total = await FantasyTeam.countDocuments(filter);

    res.json({
      success: true,
      data: {
        teams,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Get user teams error:', error);
    throw error;
  }
}));

// @route   GET /api/teams/:id
// @desc    Get fantasy team by ID
// @access  Private
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const team = await FantasyTeam.findById(id)
      .populate('matchId', 'title sport startTime team1 team2 venue')
      .populate('players.playerId', 'name role team avatar price stats');
    
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user owns this team
    if (team.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: team
    });
  } catch (error) {
    logger.error(`Get team ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   POST /api/teams
// @desc    Create a new fantasy team
// @access  Private
router.post('/', authenticateToken, validateRequest(teamSchemas.create), asyncHandler(async (req, res) => {
  const { name, matchId, players, captain, viceCaptain } = req.body;

  try {
    // Verify match exists and is upcoming
    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(400).json({
        success: false,
        message: 'Match not found'
      });
    }

    if (match.status !== 'upcoming') {
      return res.status(400).json({
        success: false,
        message: 'Cannot create team for this match'
      });
    }

    if (match.isFantasyDeadlinePassed()) {
      return res.status(400).json({
        success: false,
        message: 'Fantasy deadline has passed for this match'
      });
    }

    // Verify players exist and are valid
    const playerIds = [...players, captain, viceCaptain];
    const validPlayers = await Player.find({
      _id: { $in: playerIds },
      sport: match.sport,
      isActive: true
    });

    if (validPlayers.length !== playerIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some players are invalid or inactive'
      });
    }

    // Check if user already has a team for this match
    const existingTeam = await FantasyTeam.findOne({
      userId: req.user._id,
      matchId
    });

    if (existingTeam) {
      return res.status(400).json({
        success: false,
        message: 'You already have a team for this match'
      });
    }

    // Create team
    const team = new FantasyTeam({
      name,
      userId: req.user._id,
      matchId,
      sport: match.sport,
      players: validPlayers.map(player => ({
        playerId: player._id,
        name: player.name,
        role: player.role,
        team: player.team.name,
        price: player.price
      })),
      captain,
      viceCaptain
    });

    await team.save();

    // Clear related caches
    await cache.del(`teams:${req.user._id}:${matchId}`);

    // Log team creation
    logger.info(`Fantasy team created: ${name} by ${req.user.username} for match: ${match.title}`);

    res.status(201).json({
      success: true,
      message: 'Team created successfully',
      data: team
    });
  } catch (error) {
    logger.error('Create team error:', error);
    throw error;
  }
}));

// @route   PUT /api/teams/:id
// @desc    Update fantasy team
// @access  Private
router.put('/:id', authenticateToken, validateRequest(teamSchemas.update), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  try {
    const team = await FantasyTeam.findById(id);
    
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user owns this team
    if (team.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if team can be modified
    if (team.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Team cannot be modified in current status'
      });
    }

    // Update team
    if (updateData.name) team.name = updateData.name;
    if (updateData.players) {
      // Validate new players
      const validPlayers = await Player.find({
        _id: { $in: updateData.players },
        sport: team.sport,
        isActive: true
      });

      if (validPlayers.length !== updateData.players.length) {
        return res.status(400).json({
          success: false,
          message: 'Some players are invalid or inactive'
        });
      }

      team.players = validPlayers.map(player => ({
        playerId: player._id,
        name: player.name,
        role: player.role,
        team: player.team.name,
        price: player.price
      }));
    }

    if (updateData.captain) {
      // Verify captain is in team
      const captainInTeam = team.players.find(p => p.playerId.toString() === updateData.captain);
      if (!captainInTeam) {
        return res.status(400).json({
          success: false,
          message: 'Captain must be in the team'
        });
      }
      team.captain = updateData.captain;
    }

    if (updateData.viceCaptain) {
      // Verify vice-captain is in team
      const viceCaptainInTeam = team.players.find(p => p.playerId.toString() === updateData.viceCaptain);
      if (!viceCaptainInTeam) {
        return res.status(400).json({
          success: false,
          message: 'Vice-captain must be in the team'
        });
      }
      team.viceCaptain = updateData.viceCaptain;
    }

    await team.save();

    // Clear related caches
    await cache.del(`teams:${req.user._id}:${team.matchId}`);

    // Emit team update event
    events.teamUpdate(req.user._id, {
      type: 'update',
      team: team.getSummary()
    });

    // Log team update
    logger.info(`Fantasy team updated: ${team.name} by ${req.user.username}`);

    res.json({
      success: true,
      message: 'Team updated successfully',
      data: team
    });
  } catch (error) {
    logger.error(`Update team ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   DELETE /api/teams/:id
// @desc    Delete fantasy team
// @access  Private
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const team = await FantasyTeam.findById(id);
    
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user owns this team
    if (team.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if team can be deleted
    if (team.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Team cannot be deleted in current status'
      });
    }

    await FantasyTeam.findByIdAndDelete(id);

    // Clear related caches
    await cache.del(`teams:${req.user._id}:${team.matchId}`);

    // Log team deletion
    logger.info(`Fantasy team deleted: ${team.name} by ${req.user.username}`);

    res.json({
      success: true,
      message: 'Team deleted successfully'
    });
  } catch (error) {
    logger.error(`Delete team ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   POST /api/teams/:id/submit
// @desc    Submit fantasy team
// @access  Private
router.post('/:id/submit', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const team = await FantasyTeam.findById(id);
    
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user owns this team
    if (team.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Submit team
    await team.submitTeam();

    // Clear related caches
    await cache.del(`teams:${req.user._id}:${team.matchId}`);

    // Emit team update event
    events.teamUpdate(req.user._id, {
      type: 'submitted',
      team: team.getSummary()
    });

    // Log team submission
    logger.info(`Fantasy team submitted: ${team.name} by ${req.user.username}`);

    res.json({
      success: true,
      message: 'Team submitted successfully',
      data: team
    });
  } catch (error) {
    logger.error(`Submit team ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   POST /api/teams/:id/add-player
// @desc    Add player to team
// @access  Private
router.post('/:id/add-player', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { playerId } = req.body;

  if (!playerId) {
    return res.status(400).json({
      success: false,
      message: 'Player ID is required'
    });
  }

  try {
    const team = await FantasyTeam.findById(id);
    
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user owns this team
    if (team.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get player details
    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(400).json({
        success: false,
        message: 'Player not found'
      });
    }

    // Add player to team
    await team.addPlayer(player);

    // Clear related caches
    await cache.del(`teams:${req.user._id}:${team.matchId}`);

    // Emit team update event
    events.teamUpdate(req.user._id, {
      type: 'player_added',
      team: team.getSummary(),
      player: player.getSummary()
    });

    res.json({
      success: true,
      message: 'Player added successfully',
      data: {
        team: team.getSummary(),
        player: player.getSummary()
      }
    });
  } catch (error) {
    logger.error(`Add player to team ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   DELETE /api/teams/:id/remove-player/:playerId
// @desc    Remove player from team
// @access  Private
router.delete('/:id/remove-player/:playerId', authenticateToken, asyncHandler(async (req, res) => {
  const { id, playerId } = req.params;

  try {
    const team = await FantasyTeam.findById(id);
    
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user owns this team
    if (team.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Remove player from team
    await team.removePlayer(playerId);

    // Clear related caches
    await cache.del(`teams:${req.user._id}:${team.matchId}`);

    // Emit team update event
    events.teamUpdate(req.user._id, {
      type: 'player_removed',
      team: team.getSummary(),
      playerId
    });

    res.json({
      success: true,
      message: 'Player removed successfully',
      data: team.getSummary()
    });
  } catch (error) {
    logger.error(`Remove player from team ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   POST /api/teams/:id/set-captain
// @desc    Set team captain
// @access  Private
router.post('/:id/set-captain', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { playerId } = req.body;

  if (!playerId) {
    return res.status(400).json({
      success: false,
      message: 'Player ID is required'
    });
  }

  try {
    const team = await FantasyTeam.findById(id);
    
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user owns this team
    if (team.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Set captain
    await team.setCaptain(playerId);

    // Clear related caches
    await cache.del(`teams:${req.user._id}:${team.matchId}`);

    // Emit team update event
    events.teamUpdate(req.user._id, {
      type: 'captain_set',
      team: team.getSummary(),
      captain: playerId
    });

    res.json({
      success: true,
      message: 'Captain set successfully',
      data: team.getSummary()
    });
  } catch (error) {
    logger.error(`Set captain for team ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   POST /api/teams/:id/set-vice-captain
// @desc    Set team vice-captain
// @access  Private
router.post('/:id/set-vice-captain', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { playerId } = req.body;

  if (!playerId) {
    return res.status(400).json({
      success: false,
      message: 'Player ID is required'
    });
  }

  try {
    const team = await FantasyTeam.findById(id);
    
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user owns this team
    if (team.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Set vice-captain
    await team.setViceCaptain(playerId);

    // Clear related caches
    await cache.del(`teams:${req.user._id}:${team.matchId}`);

    // Emit team update event
    events.teamUpdate(req.user._id, {
      type: 'vice_captain_set',
      team: team.getSummary(),
      viceCaptain: playerId
    });

    res.json({
      success: true,
      message: 'Vice-captain set successfully',
      data: team.getSummary()
    });
  } catch (error) {
    logger.error(`Set vice-captain for team ${req.params.id} error:`, error);
    throw error;
  }
}));

// @route   GET /api/teams/:id/validate
// @desc    Validate team composition
// @access  Private
router.get('/:id/validate', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const team = await FantasyTeam.findById(id);
    
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user owns this team
    if (team.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get validation results
    const validation = {
      isComplete: team.isComplete,
      isOverBudget: team.isOverBudget,
      teamSize: team.teamSize,
      teamValue: team.teamValue,
      remainingBudget: team.remainingBudget,
      hasCaptain: !!team.captain,
      hasViceCaptain: !!team.viceCaptain,
      errors: []
    };

    // Check for specific errors
    if (!team.isComplete) {
      validation.errors.push('Team is incomplete');
    }
    if (team.isOverBudget) {
      validation.errors.push('Team exceeds budget');
    }
    if (!team.captain) {
      validation.errors.push('Captain is required');
    }
    if (!team.viceCaptain) {
      validation.errors.push('Vice-captain is required');
    }

    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    logger.error(`Validate team ${req.params.id} error:`, error);
    throw error;
  }
}));

module.exports = router;
