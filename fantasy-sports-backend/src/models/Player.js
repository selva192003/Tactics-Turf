const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  externalId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  shortName: {
    type: String,
    required: true
  },
  fullName: String,
  dateOfBirth: Date,
  nationality: String,
  sport: {
    type: String,
    required: true,
    enum: ['cricket', 'football', 'basketball', 'tennis']
  },
  role: {
    type: String,
    required: true,
    enum: ['batsman', 'bowler', 'all-rounder', 'wicket-keeper', 'goalkeeper', 'defender', 'midfielder', 'forward', 'guard', 'center', 'power-forward', 'small-forward', 'point-guard', 'shooting-guard']
  },
  team: {
    name: { type: String, required: true },
    shortName: { type: String, required: true },
    logo: String
  },
  avatar: String,
  jerseyNumber: Number,
  isActive: {
    type: Boolean,
    default: true
  },
  isPlaying: {
    type: Boolean,
    default: false
  },
  isInjured: {
    type: Boolean,
    default: false
  },
  injuryDetails: String,
  stats: {
    // Cricket stats
    batting: {
      matches: { type: Number, default: 0 },
      runs: { type: Number, default: 0 },
      average: { type: Number, default: 0 },
      strikeRate: { type: Number, default: 0 },
      fifties: { type: Number, default: 0 },
      hundreds: { type: Number, default: 0 }
    },
    bowling: {
      matches: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      average: { type: Number, default: 0 },
      economy: { type: Number, default: 0 },
      bestBowling: String
    },
    // Football stats
    football: {
      matches: { type: Number, default: 0 },
      goals: { type: Number, default: 0 },
      assists: { type: Number, default: 0 },
      cleanSheets: { type: Number, default: 0 },
      yellowCards: { type: Number, default: 0 },
      redCards: { type: Number, default: 0 }
    },
    // Basketball stats
    basketball: {
      matches: { type: Number, default: 0 },
      points: { type: Number, default: 0 },
      rebounds: { type: Number, default: 0 },
      assists: { type: Number, default: 0 },
      steals: { type: Number, default: 0 },
      blocks: { type: Number, default: 0 }
    }
  },
  recentForm: [{
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
    points: Number,
    performance: String,
    date: Date
  }],
  fantasyPoints: {
    total: { type: Number, default: 0 },
    average: { type: Number, default: 0 },
    best: { type: Number, default: 0 }
  },
  price: {
    type: Number,
    required: true,
    min: 1,
    max: 100
  },
  popularity: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  captainBonus: {
    type: Number,
    default: 2.0
  },
  viceCaptainBonus: {
    type: Number,
    default: 1.5
  },
  specialAbilities: [{
    name: String,
    description: String,
    bonusPoints: Number
  }],
  achievements: [{
    title: String,
    description: String,
    date: Date,
    tournament: String
  }],
  socialMedia: {
    twitter: String,
    instagram: String,
    facebook: String
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
playerSchema.index({ sport: 1, role: 1 });
playerSchema.index({ 'team.name': 1 });
playerSchema.index({ externalId: 1 });
playerSchema.index({ name: 1 });
playerSchema.index({ isActive: 1, isPlaying: 1 });

// Virtual for total matches
playerSchema.virtual('totalMatches').get(function() {
  if (this.sport === 'cricket') {
    return Math.max(this.stats.batting.matches, this.stats.bowling.matches);
  } else if (this.sport === 'football') {
    return this.stats.football.matches;
  } else if (this.sport === 'basketball') {
    return this.stats.basketball.matches;
  }
  return 0;
});

// Method to get player summary
playerSchema.methods.getSummary = function() {
  return {
    id: this._id,
    name: this.name,
    shortName: this.shortName,
    role: this.role,
    team: this.team,
    sport: this.sport,
    avatar: this.avatar,
    price: this.price,
    isActive: this.isActive,
    isPlaying: this.isPlaying,
    fantasyPoints: this.fantasyPoints,
    popularity: this.popularity
  };
};

// Method to get detailed stats
playerSchema.methods.getDetailedStats = function() {
  const baseStats = this.getSummary();
  
  if (this.sport === 'cricket') {
    baseStats.battingStats = this.stats.batting;
    baseStats.bowlingStats = this.stats.bowling;
  } else if (this.sport === 'football') {
    baseStats.footballStats = this.stats.football;
  } else if (this.sport === 'basketball') {
    baseStats.basketballStats = this.stats.basketball;
  }
  
  baseStats.recentForm = this.recentForm.slice(-5); // Last 5 matches
  baseStats.achievements = this.achievements.slice(-3); // Last 3 achievements
  
  return baseStats;
};

// Method to update fantasy points
playerSchema.methods.updateFantasyPoints = function(matchPoints) {
  this.fantasyPoints.total += matchPoints;
  this.fantasyPoints.average = this.fantasyPoints.total / Math.max(this.recentForm.length, 1);
  
  if (matchPoints > this.fantasyPoints.best) {
    this.fantasyPoints.best = matchPoints;
  }
  
  return this.save();
};

module.exports = mongoose.model('Player', playerSchema);
