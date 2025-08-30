const mongoose = require('mongoose');

const contestSchema = new mongoose.Schema({
  name: {
    type: String,
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
  contestType: {
    type: String,
    required: true,
    enum: ['public', 'private', 'head-to-head', 'multi-entry']
  },
  entryFee: {
    type: Number,
    required: true,
    min: 0
  },
  totalSpots: {
    type: Number,
    required: true,
    min: 2,
    max: 100000
  },
  filledSpots: {
    type: Number,
    default: 0
  },
  prizePool: {
    type: Number,
    required: true,
    min: 0
  },
  prizeDistribution: [{
    rank: { type: Number, required: true },
    prize: { type: Number, required: true },
    percentage: { type: Number, required: true }
  }],
  guaranteedPrize: {
    type: Boolean,
    default: false
  },
  isGuaranteed: {
    type: Boolean,
    default: false
  },
  maxWinners: {
    type: Number,
    default: 1
  },
  entryType: {
    type: String,
    enum: ['single', 'multiple'],
    default: 'single'
  },
  maxEntriesPerUser: {
    type: Number,
    default: 1
  },
  teamSize: {
    type: Number,
    required: true,
    min: 1,
    max: 25
  },
  captainRequired: {
    type: Boolean,
    default: true
  },
  viceCaptainRequired: {
    type: Boolean,
    default: true
  },
  playerSelectionRules: {
    maxPlayersPerTeam: { type: Number, default: 7 },
    minBatsmen: { type: Number, default: 0 },
    maxBatsmen: { type: Number, default: 25 },
    minBowlers: { type: Number, default: 0 },
    maxBowlers: { type: Number, default: 25 },
    minAllRounders: { type: Number, default: 0 },
    maxAllRounders: { type: Number, default: 25 },
    minWicketKeepers: { type: Number, default: 0 },
    maxWicketKeepers: { type: Number, default: 25 }
  },
  scoringRules: {
    // Cricket scoring
    cricket: {
      run: { type: Number, default: 1 },
      four: { type: Number, default: 1 },
      six: { type: Number, default: 2 },
      fifty: { type: Number, default: 10 },
      hundred: { type: Number, default: 20 },
      wicket: { type: Number, default: 10 },
      maiden: { type: Number, default: 10 },
      catch: { type: Number, default: 10 },
      stumping: { type: Number, default: 10 },
      runOut: { type: Number, default: 6 }
    },
    // Football scoring
    football: {
      goal: { type: Number, default: 10 },
      assist: { type: Number, default: 6 },
      cleanSheet: { type: Number, default: 4 },
      yellowCard: { type: Number, default: -1 },
      redCard: { type: Number, default: -3 }
    }
  },
  status: {
    type: String,
    enum: ['upcoming', 'live', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  registrationDeadline: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'FantasyTeam' },
    entryTime: { type: Date, default: Date.now },
    rank: Number,
    points: { type: Number, default: 0 },
    prize: { type: Number, default: 0 },
    isWinner: { type: Boolean, default: false }
  }],
  leaderboard: [{
    rank: Number,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    teamName: String,
    points: Number,
    prize: Number
  }],
  statistics: {
    totalEntries: { type: Number, default: 0 },
    uniqueParticipants: { type: Number, default: 0 },
    averagePoints: { type: Number, default: 0 },
    highestPoints: { type: Number, default: 0 },
    lowestPoints: { type: Number, default: 0 }
  },
  cancellationPolicy: {
    isRefundable: { type: Boolean, default: true },
    refundPercentage: { type: Number, default: 100 },
    cancellationDeadline: Date
  },
  terms: [String],
  tags: [String],
  featured: {
    type: Boolean,
    default: false
  },
  priority: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
contestSchema.index({ matchId: 1, status: 1 });
contestSchema.index({ sport: 1, status: 1 });
contestSchema.index({ contestType: 1, isActive: 1 });
contestSchema.index({ startTime: 1 });
contestSchema.index({ entryFee: 1, totalSpots: 1 });

// Virtual for available spots
contestSchema.virtual('availableSpots').get(function() {
  return this.totalSpots - this.filledSpots;
});

// Virtual for isFull
contestSchema.virtual('isFull').get(function() {
  return this.filledSpots >= this.totalSpots;
});

// Virtual for isRegistrationOpen
contestSchema.virtual('isRegistrationOpen').get(function() {
  return new Date() < this.registrationDeadline && !this.isFull;
});

// Method to add participant
contestSchema.methods.addParticipant = function(userId, teamId) {
  if (this.isFull) {
    throw new Error('Contest is full');
  }
  
  if (!this.isRegistrationOpen) {
    throw new Error('Registration is closed');
  }
  
  const existingParticipant = this.participants.find(p => p.userId.toString() === userId.toString());
  if (existingParticipant && this.entryType === 'single') {
    throw new Error('User already registered for this contest');
  }
  
  this.participants.push({
    userId,
    teamId,
    entryTime: new Date()
  });
  
  this.filledSpots++;
  this.statistics.totalEntries++;
  this.statistics.uniqueParticipants = new Set(this.participants.map(p => p.userId.toString())).size;
  
  return this.save();
};

// Method to remove participant
contestSchema.methods.removeParticipant = function(userId) {
  const participantIndex = this.participants.findIndex(p => p.userId.toString() === userId.toString());
  if (participantIndex === -1) {
    throw new Error('Participant not found');
  }
  
  this.participants.splice(participantIndex, 1);
  this.filledSpots--;
  this.statistics.totalEntries--;
  this.statistics.uniqueParticipants = new Set(this.participants.map(p => p.userId.toString())).size;
  
  return this.save();
};

// Method to update leaderboard
contestSchema.methods.updateLeaderboard = function() {
  // Sort participants by points (descending)
  const sortedParticipants = [...this.participants].sort((a, b) => b.points - a.points);
  
  // Update ranks and prizes
  sortedParticipants.forEach((participant, index) => {
    const rank = index + 1;
    participant.rank = rank;
    
    // Find prize for this rank
    const prizeInfo = this.prizeDistribution.find(p => p.rank === rank);
    if (prizeInfo) {
      participant.prize = prizeInfo.prize;
      participant.isWinner = true;
    }
  });
  
  // Update leaderboard
  this.leaderboard = sortedParticipants.map(p => ({
    rank: p.rank,
    userId: p.userId,
    username: p.username || 'Unknown',
    teamName: p.teamName || 'Team',
    points: p.points,
    prize: p.prize
  }));
  
  // Update statistics
  if (this.participants.length > 0) {
    this.statistics.averagePoints = this.participants.reduce((sum, p) => sum + p.points, 0) / this.participants.length;
    this.statistics.highestPoints = Math.max(...this.participants.map(p => p.points));
    this.statistics.lowestPoints = Math.min(...this.participants.map(p => p.points));
  }
  
  return this.save();
};

// Method to get contest summary
contestSchema.methods.getSummary = function() {
  return {
    id: this._id,
    name: this.name,
    sport: this.sport,
    contestType: this.contestType,
    entryFee: this.entryFee,
    totalSpots: this.totalSpots,
    filledSpots: this.filledSpots,
    availableSpots: this.availableSpots,
    prizePool: this.prizePool,
    status: this.status,
    startTime: this.startTime,
    registrationDeadline: this.registrationDeadline,
    isRegistrationOpen: this.isRegistrationOpen,
    isFull: this.isFull,
    teamSize: this.teamSize,
    featured: this.featured
  };
};

module.exports = mongoose.model('Contest', contestSchema);
