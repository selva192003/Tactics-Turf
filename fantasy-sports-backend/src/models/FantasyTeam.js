const mongoose = require('mongoose');

const fantasyTeamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true
  },
  sport: {
    type: String,
    required: true,
    enum: ['cricket', 'football', 'basketball', 'tennis']
  },
  players: [{
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    name: String,
    role: String,
    team: String,
    price: Number,
    isCaptain: { type: Boolean, default: false },
    isViceCaptain: { type: Boolean, default: false },
    points: { type: Number, default: 0 },
    performance: {
      runs: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      catches: { type: Number, default: 0 },
      stumping: { type: Number, default: 0 },
      runOut: { type: Number, default: 0 },
      goals: { type: Number, default: 0 },
      assists: { type: Number, default: 0 },
      cleanSheets: { type: Number, default: 0 },
      yellowCards: { type: Number, default: 0 },
      redCards: { type: Number, default: 0 }
    }
  }],
  captain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player'
  },
  viceCaptain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player'
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  rank: {
    type: Number,
    default: null
  },
  prize: {
    type: Number,
    default: 0
  },
  isWinner: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'locked', 'scored'],
    default: 'draft'
  },
  submittedAt: Date,
  lockedAt: Date,
  scoredAt: Date,
  teamValue: {
    type: Number,
    default: 0
  },
  remainingBudget: {
    type: Number,
    default: 100
  },
  formation: {
    type: String,
    default: ''
  },
  substitutions: [{
    playerOut: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    playerIn: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    timestamp: { type: Date, default: Date.now }
  }],
  powerPlay: {
    isActive: { type: Boolean, default: false },
    activatedAt: Date,
    duration: Number
  },
  strategy: {
    type: String,
    enum: ['balanced', 'batting-heavy', 'bowling-heavy', 'aggressive', 'defensive'],
    default: 'balanced'
  },
  notes: String,
  isPublic: {
    type: Boolean,
    default: false
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    comment: String,
    timestamp: { type: Date, default: Date.now }
  }],
  tags: [String],
  isTemplate: {
    type: Boolean,
    default: false
  },
  templateName: String,
  templateDescription: String,
  usageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
fantasyTeamSchema.index({ userId: 1, matchId: 1 });
fantasyTeamSchema.index({ matchId: 1, status: 1 });
fantasyTeamSchema.index({ sport: 1, status: 1 });
fantasyTeamSchema.index({ totalPoints: -1 });

// Virtual for team size
fantasyTeamSchema.virtual('teamSize').get(function() {
  return this.players.length;
});

// Virtual for isComplete
fantasyTeamSchema.virtual('isComplete').get(function() {
  if (this.sport === 'cricket') {
    return this.players.length === 11 && this.captain && this.viceCaptain;
  } else if (this.sport === 'football') {
    return this.players.length === 11 && this.captain && this.viceCaptain;
  }
  return this.players.length > 0;
});

// Virtual for isOverBudget
fantasyTeamSchema.virtual('isOverBudget').get(function() {
  return this.teamValue > 100;
});

// Method to add player
fantasyTeamSchema.methods.addPlayer = function(player) {
  if (this.status !== 'draft') {
    throw new Error('Cannot modify locked team');
  }
  
  // Check if player already exists
  const existingPlayer = this.players.find(p => p.playerId.toString() === player._id.toString());
  if (existingPlayer) {
    throw new Error('Player already in team');
  }
  
  // Check budget
  if (this.teamValue + player.price > 100) {
    throw new Error('Insufficient budget');
  }
  
  // Check team size limits
  if (this.players.length >= 25) {
    throw new Error('Maximum team size reached');
  }
  
  // Add player
  this.players.push({
    playerId: player._id,
    name: player.name,
    role: player.role,
    team: player.team.name,
    price: player.price
  });
  
  this.teamValue += player.price;
  this.remainingBudget = 100 - this.teamValue;
  
  return this.save();
};

// Method to remove player
fantasyTeamSchema.methods.removePlayer = function(playerId) {
  if (this.status !== 'draft') {
    throw new Error('Cannot modify locked team');
  }
  
  const playerIndex = this.players.findIndex(p => p.playerId.toString() === playerId.toString());
  if (playerIndex === -1) {
    throw new Error('Player not found in team');
  }
  
  const player = this.players[playerIndex];
  
  // Remove captain/vice-captain designation if needed
  if (this.captain && this.captain.toString() === playerId.toString()) {
    this.captain = null;
  }
  if (this.viceCaptain && this.viceCaptain.toString() === playerId.toString()) {
    this.viceCaptain = null;
  }
  
  // Remove player
  this.players.splice(playerIndex, 1);
  this.teamValue -= player.price;
  this.remainingBudget = 100 - this.teamValue;
  
  return this.save();
};

// Method to set captain
fantasyTeamSchema.methods.setCaptain = function(playerId) {
  if (this.status !== 'draft') {
    throw new Error('Cannot modify locked team');
  }
  
  const player = this.players.find(p => p.playerId.toString() === playerId.toString());
  if (!player) {
    throw new Error('Player not found in team');
  }
  
  // Remove existing captain designation
  this.players.forEach(p => p.isCaptain = false);
  
  // Set new captain
  player.isCaptain = true;
  this.captain = playerId;
  
  return this.save();
};

// Method to set vice-captain
fantasyTeamSchema.methods.setViceCaptain = function(playerId) {
  if (this.status !== 'draft') {
    throw new Error('Cannot modify locked team');
  }
  
  const player = this.players.find(p => p.playerId.toString() === playerId.toString());
  if (!player) {
    throw new Error('Player not found in team');
  }
  
  // Remove existing vice-captain designation
  this.players.forEach(p => p.isViceCaptain = false);
  
  // Set new vice-captain
  player.isViceCaptain = true;
  this.viceCaptain = playerId;
  
  return this.save();
};

// Method to submit team
fantasyTeamSchema.methods.submitTeam = function() {
  if (!this.isComplete) {
    throw new Error('Team is incomplete');
  }
  
  if (this.isOverBudget) {
    throw new Error('Team exceeds budget');
  }
  
  this.status = 'submitted';
  this.submittedAt = new Date();
  
  return this.save();
};

// Method to lock team
fantasyTeamSchema.methods.lockTeam = function() {
  this.status = 'locked';
  this.lockedAt = new Date();
  
  return this.save();
};

// Method to calculate points
fantasyTeamSchema.methods.calculatePoints = function() {
  let totalPoints = 0;
  
  this.players.forEach(player => {
    let playerPoints = 0;
    
    // Calculate points based on sport and performance
    if (this.sport === 'cricket') {
      playerPoints += (player.performance.runs || 0) * 1;
      playerPoints += (player.performance.wickets || 0) * 10;
      playerPoints += (player.performance.catches || 0) * 10;
      playerPoints += (player.performance.stumping || 0) * 10;
      playerPoints += (player.performance.runOut || 0) * 6;
    } else if (this.sport === 'football') {
      playerPoints += (player.performance.goals || 0) * 10;
      playerPoints += (player.performance.assists || 0) * 6;
      playerPoints += (player.performance.cleanSheets || 0) * 4;
      playerPoints += (player.performance.yellowCards || 0) * -1;
      playerPoints += (player.performance.redCards || 0) * -3;
    }
    
    // Apply captain/vice-captain bonus
    if (player.isCaptain) {
      playerPoints *= 2;
    } else if (player.isViceCaptain) {
      playerPoints *= 1.5;
    }
    
    player.points = playerPoints;
    totalPoints += playerPoints;
  });
  
  this.totalPoints = totalPoints;
  this.status = 'scored';
  this.scoredAt = new Date();
  
  return this.save();
};

// Method to get team summary
fantasyTeamSchema.methods.getSummary = function() {
  return {
    id: this._id,
    name: this.name,
    sport: this.sport,
    teamSize: this.teamSize,
    totalPoints: this.totalPoints,
    rank: this.rank,
    prize: this.prize,
    status: this.status,
    teamValue: this.teamValue,
    remainingBudget: this.remainingBudget,
    captain: this.captain,
    viceCaptain: this.viceCaptain,
    isComplete: this.isComplete,
    isOverBudget: this.isOverBudget,
    createdAt: this.createdAt
  };
};

// Method to get detailed team
fantasyTeamSchema.methods.getDetailedTeam = function() {
  const summary = this.getSummary();
  summary.players = this.players.map(player => ({
    id: player.playerId,
    name: player.name,
    role: player.role,
    team: player.team,
    price: player.price,
    isCaptain: player.isCaptain,
    isViceCaptain: player.isViceCaptain,
    points: player.points,
    performance: player.performance
  }));
  
  return summary;
};

module.exports = mongoose.model('FantasyTeam', fantasyTeamSchema);
