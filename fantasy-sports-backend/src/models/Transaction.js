const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['deposit', 'withdrawal', 'contest_entry', 'contest_winnings', 'bonus', 'refund', 'referral_bonus', 'admin_adjustment']
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded']
  },
  description: {
    type: String,
    required: true
  },
  reference: {
    type: String,
    required: true,
    unique: true
  },
  externalReference: String,
  paymentMethod: {
    type: String,
    enum: ['upi', 'card', 'netbanking', 'wallet', 'razorpay', 'stripe', 'internal', 'bonus']
  },
  paymentGateway: {
    type: String,
    enum: ['razorpay', 'stripe', 'paytm', 'phonepe', 'internal']
  },
  gatewayResponse: {
    success: Boolean,
    message: String,
    transactionId: String,
    errorCode: String,
    errorMessage: String,
    rawResponse: mongoose.Schema.Types.Mixed
  },
  metadata: {
    contestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest' },
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'FantasyTeam' },
    referralCode: String,
    adminNote: String,
    ipAddress: String,
    userAgent: String
  },
  fees: {
    amount: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    description: String
  },
  netAmount: {
    type: Number,
    required: true
  },
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  processedAt: Date,
  failureReason: String,
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  nextRetryAt: Date,
  isReversible: {
    type: Boolean,
    default: false
  },
  reversedAt: Date,
  reversedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reversalReason: String,
  tags: [String],
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  isSettled: {
    type: Boolean,
    default: false
  },
  settledAt: Date,
  settlementReference: String
}, {
  timestamps: true
});

// Indexes
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ reference: 1 });
transactionSchema.index({ externalReference: 1 });
transactionSchema.index({ status: 1, processedAt: 1 });

// Virtual for isPending
transactionSchema.virtual('isPending').get(function() {
  return this.status === 'pending';
});

// Virtual for isCompleted
transactionSchema.virtual('isCompleted').get(function() {
  return this.status === 'completed';
});

// Virtual for isFailed
transactionSchema.virtual('isFailed').get(function() {
  return this.status === 'failed';
});

// Virtual for canRetry
transactionSchema.virtual('canRetry').get(function() {
  return this.status === 'failed' && this.retryCount < this.maxRetries;
});

// Method to generate reference
transactionSchema.methods.generateReference = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  const type = this.type.substr(0, 3).toUpperCase();
  return `${type}${timestamp}${random}`.toUpperCase();
};

// Method to process transaction
transactionSchema.methods.process = function() {
  if (this.status !== 'pending') {
    throw new Error('Transaction is not pending');
  }
  
  this.status = 'completed';
  this.processedAt = new Date();
  
  return this.save();
};

// Method to fail transaction
transactionSchema.methods.fail = function(reason) {
  this.status = 'failed';
  this.failureReason = reason;
  this.retryCount++;
  
  if (this.retryCount < this.maxRetries) {
    // Schedule retry after exponential backoff
    const delay = Math.pow(2, this.retryCount) * 1000; // 2^retryCount seconds
    this.nextRetryAt = new Date(Date.now() + delay);
  }
  
  return this.save();
};

// Method to retry transaction
transactionSchema.methods.retry = function() {
  if (!this.canRetry) {
    throw new Error('Transaction cannot be retried');
  }
  
  this.status = 'pending';
  this.failureReason = undefined;
  this.nextRetryAt = undefined;
  
  return this.save();
};

// Method to reverse transaction
transactionSchema.methods.reverse = function(reason, reversedBy) {
  if (!this.isReversible) {
    throw new Error('Transaction is not reversible');
  }
  
  if (this.status !== 'completed') {
    throw new Error('Only completed transactions can be reversed');
  }
  
  this.status = 'refunded';
  this.reversedAt = new Date();
  this.reversedBy = reversedBy;
  this.reversalReason = reason;
  
  return this.save();
};

// Method to get transaction summary
transactionSchema.methods.getSummary = function() {
  return {
    id: this._id,
    type: this.type,
    amount: this.amount,
    currency: this.currency,
    status: this.status,
    description: this.description,
    reference: this.reference,
    netAmount: this.netAmount,
    balanceBefore: this.balanceBefore,
    balanceAfter: this.balanceAfter,
    createdAt: this.createdAt,
    processedAt: this.processedAt
  };
};

// Static method to create deposit transaction
transactionSchema.statics.createDeposit = function(userId, amount, paymentMethod, paymentGateway, metadata = {}) {
  const transaction = new this({
    userId,
    type: 'deposit',
    amount,
    status: 'pending',
    description: `Deposit of ${amount} ${this.currency || 'INR'}`,
    reference: this.generateReference(),
    paymentMethod,
    paymentGateway,
    metadata,
    netAmount: amount,
    balanceBefore: 0, // Will be updated when processing
    balanceAfter: 0    // Will be updated when processing
  });
  
  return transaction;
};

// Static method to create contest entry transaction
transactionSchema.statics.createContestEntry = function(userId, amount, contestId, matchId, teamId, metadata = {}) {
  const transaction = new this({
    userId,
    type: 'contest_entry',
    amount: -amount, // Negative amount for debits
    status: 'completed',
    description: `Contest entry fee`,
    reference: this.generateReference(),
    paymentMethod: 'internal',
    paymentGateway: 'internal',
    metadata: { contestId, matchId, teamId, ...metadata },
    netAmount: -amount,
    balanceBefore: 0, // Will be updated when processing
    balanceAfter: 0    // Will be updated when processing
  });
  
  return transaction;
};

// Static method to create contest winnings transaction
transactionSchema.statics.createContestWinnings = function(userId, amount, contestId, matchId, teamId, metadata = {}) {
  const transaction = new this({
    userId,
    type: 'contest_winnings',
    amount,
    status: 'completed',
    description: `Contest winnings`,
    reference: this.generateReference(),
    paymentMethod: 'bonus',
    paymentGateway: 'internal',
    metadata: { contestId, matchId, teamId, ...metadata },
    netAmount: amount,
    balanceBefore: 0, // Will be updated when processing
    balanceAfter: 0    // Will be updated when processing
  });
  
  return transaction;
};

module.exports = mongoose.model('Transaction', transactionSchema);
