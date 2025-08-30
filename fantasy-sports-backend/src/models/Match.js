const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  externalId: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  sport: {
    type: String,
    required: true,
    enum: ['cricket', 'football', 'basketball', 'tennis']
  },
  tournament: {
    type: String,
    required: true
  },
  team1: {
    name: { type: String, required: true },
    shortName: { type: String, required: true },
    logo: String
  },
  team2: {
    name: { type: String, required: true },
    shortName: { type: String, required: true },
    logo: String
  },
  venue: {
    name: String,
    city: String,
    country: String
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  status: {
    type: String,
    enum: ['upcoming', 'live', 'completed', 'cancelled', 'postponed'],
    default: 'upcoming'
  },
  currentScore: {
    team1: {
      runs: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      overs: { type: Number, default: 0 }
    },
    team2: {
      runs: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      overs: { type: Number, default: 0 }
    }
  },
  matchFormat: {
    type: String,
    enum: ['t20', 'odi', 'test', '90min', '45min', '3set', '5set'],
    required: true
  },
  isFantasyEnabled: {
    type: Boolean,
    default: true
  },
  fantasyDeadline: {
    type: Date,
    required: true
  },
  maxContests: {
    type: Number,
    default: 100
  },
  currentContests: {
    type: Number,
    default: 0
  },
  totalPrizePool: {
    type: Number,
    default: 0
  },
  totalParticipants: {
    type: Number,
    default: 0
  },
  weather: {
    condition: String,
    temperature: Number,
    humidity: Number
  },
  pitchReport: {
    type: String,
    default: ''
  },
  toss: {
    wonBy: String,
    decision: String
  },
  highlights: [{
    timestamp: Date,
    event: String,
    description: String
  }],
  streamingUrl: String,
  isHighlightsEnabled: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
matchSchema.index({ sport: 1, status: 1 });
matchSchema.index({ startTime: 1 });
matchSchema.index({ externalId: 1 });
matchSchema.index({ 'team1.name': 1, 'team2.name': 1 });

// Virtual for match duration
matchSchema.virtual('duration').get(function() {
  if (this.startTime && this.endTime) {
    return this.endTime - this.startTime;
  }
  return null;
});

// Virtual for time until match starts
matchSchema.virtual('timeUntilStart').get(function() {
  if (this.startTime) {
    return this.startTime - new Date();
  }
  return null;
});

// Method to check if fantasy deadline has passed
matchSchema.methods.isFantasyDeadlinePassed = function() {
  return new Date() > this.fantasyDeadline;
};

// Method to check if match is live
matchSchema.methods.isLive = function() {
  const now = new Date();
  return this.startTime <= now && this.endTime >= now;
};

// Method to get match summary
matchSchema.methods.getSummary = function() {
  return {
    id: this._id,
    title: this.title,
    sport: this.sport,
    tournament: this.tournament,
    team1: this.team1,
    team2: this.team2,
    startTime: this.startTime,
    status: this.status,
    isFantasyEnabled: this.isFantasyEnabled,
    fantasyDeadline: this.fantasyDeadline,
    currentContests: this.currentContests,
    maxContests: this.maxContests
  };
};

module.exports = mongoose.model('Match', matchSchema);
