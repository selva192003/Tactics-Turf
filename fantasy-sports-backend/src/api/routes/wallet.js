const express = require('express');
const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const { authenticateToken } = require('../../middleware/auth');
const { validateRequest, walletSchemas } = require('../../middleware/validation');
const { asyncHandler } = require('../../middleware/errorHandler');
const { events } = require('../../services/websocket');
const logger = require('../../services/logger');

const router = express.Router();

// @route   GET /api/wallet/balance
// @desc    Get user wallet balance
// @access  Private
router.get('/balance', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.json({
      success: true,
      data: {
        balance: user.wallet.balance,
        totalDeposited: user.wallet.totalDeposited,
        totalWithdrawn: user.wallet.totalWithdrawn,
        totalWon: user.wallet.totalWon,
        referralEarnings: user.referralEarnings
      }
    });
  } catch (error) {
    logger.error('Get wallet balance error:', error);
    throw error;
  }
}));

// @route   GET /api/wallet/transactions
// @desc    Get user transaction history
// @access  Private
router.get('/transactions', authenticateToken, asyncHandler(async (req, res) => {
  const { type, status, page = 1, limit = 20, startDate, endDate } = req.query;

  try {
    const filter = { userId: req.user._id };
    
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
      .limit(parseInt(limit));

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
    logger.error('Get transactions error:', error);
    throw error;
  }
}));

// @route   POST /api/wallet/deposit
// @desc    Deposit money to wallet
// @access  Private
router.post('/deposit', authenticateToken, validateRequest(walletSchemas.deposit), asyncHandler(async (req, res) => {
  const { amount, paymentMethod, upiId } = req.body;

  try {
    // Validate amount
    if (amount < 10 || amount > 100000) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be between ₹10 and ₹1,00,000'
      });
    }

    // Create transaction record
    const transaction = await Transaction.createDeposit(
      req.user._id,
      amount,
      paymentMethod,
      'razorpay' // Default to Razorpay for now
    );

    // Set metadata
    if (upiId) {
      transaction.metadata.upiId = upiId;
    }
    transaction.metadata.ipAddress = req.ip;
    transaction.metadata.userAgent = req.get('User-Agent');

    await transaction.save();

    // TODO: Integrate with actual payment gateway (Razorpay/Stripe)
    // For now, we'll simulate a successful payment
    const paymentResult = {
      success: true,
      transactionId: `PAY_${Date.now()}`,
      amount: amount,
      status: 'success'
    };

    if (paymentResult.success) {
      // Update transaction status
      transaction.status = 'completed';
      transaction.externalReference = paymentResult.transactionId;
      transaction.processedAt = new Date();
      await transaction.save();

      // Update user wallet
      const user = await User.findById(req.user._id);
      transaction.balanceBefore = user.wallet.balance;
      user.wallet.balance += amount;
      user.wallet.totalDeposited += amount;
      transaction.balanceAfter = user.wallet.balance;
      await user.save();
      await transaction.save();

      // Emit wallet update event
      events.walletUpdate(req.user._id, {
        type: 'deposit',
        amount,
        newBalance: user.wallet.balance,
        transactionId: transaction.reference
      });

      // Log successful deposit
      logger.info(`User ${req.user.username} deposited ₹${amount} to wallet`);

      res.json({
        success: true,
        message: 'Deposit successful',
        data: {
          transactionId: transaction.reference,
          amount,
          newBalance: user.wallet.balance
        }
      });
    } else {
      // Payment failed
      transaction.status = 'failed';
      transaction.failureReason = 'Payment gateway error';
      await transaction.save();

      res.status(400).json({
        success: false,
        message: 'Payment failed. Please try again.'
      });
    }
  } catch (error) {
    logger.error('Deposit error:', error);
    throw error;
  }
}));

// @route   POST /api/wallet/withdraw
// @desc    Withdraw money from wallet
// @access  Private
router.post('/withdraw', authenticateToken, validateRequest(walletSchemas.withdraw), asyncHandler(async (req, res) => {
  const { amount, bankDetails } = req.body;

  try {
    // Validate amount
    if (amount < 100 || amount > 50000) {
      return res.status(400).json({
        success: false,
        message: 'Withdrawal amount must be between ₹100 and ₹50,000'
      });
    }

    // Check user balance
    const user = await User.findById(req.user._id);
    if (user.wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    // Check minimum withdrawal
    if (amount < 100) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal amount is ₹100'
      });
    }

    // Create withdrawal transaction
    const transaction = new Transaction({
      userId: req.user._id,
      type: 'withdrawal',
      amount: -amount,
      status: 'pending',
      description: 'Withdrawal request',
      reference: Transaction.generateReference(),
      paymentMethod: 'bank_transfer',
      paymentGateway: 'internal',
      metadata: {
        bankDetails,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      },
      netAmount: -amount,
      balanceBefore: user.wallet.balance,
      balanceAfter: user.wallet.balance - amount,
      isReversible: true
    });

    await transaction.save();

    // Deduct amount from wallet
    user.wallet.balance -= amount;
    user.wallet.totalWithdrawn += amount;
    await user.save();

    // Emit wallet update event
    events.walletUpdate(req.user._id, {
      type: 'withdrawal_requested',
      amount,
      newBalance: user.wallet.balance,
      transactionId: transaction.reference
    });

    // Log withdrawal request
    logger.info(`User ${req.user.username} requested withdrawal of ₹${amount}`);

    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: {
        transactionId: transaction.reference,
        amount,
        newBalance: user.wallet.balance,
        status: 'pending'
      }
    });
  } catch (error) {
    logger.error('Withdrawal error:', error);
    throw error;
  }
}));

// @route   POST /api/wallet/transfer
// @desc    Transfer money to another user
// @access  Private
router.post('/transfer', authenticateToken, asyncHandler(async (req, res) => {
  const { recipientUsername, amount, note } = req.body;

  if (!recipientUsername || !amount) {
    return res.status(400).json({
      success: false,
      message: 'Recipient username and amount are required'
    });
  }

  if (amount < 10 || amount > 10000) {
    return res.status(400).json({
      success: false,
      message: 'Transfer amount must be between ₹10 and ₹10,000'
    });
  }

  try {
    // Check if user is trying to transfer to themselves
    if (recipientUsername === req.user.username) {
      return res.status(400).json({
        success: false,
        message: 'Cannot transfer to yourself'
      });
    }

    // Find recipient
    const recipient = await User.findOne({ username: recipientUsername });
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    // Check sender balance
    const sender = await User.findById(req.user._id);
    if (sender.wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    // Create transfer transaction for sender
    const senderTransaction = new Transaction({
      userId: req.user._id,
      type: 'transfer',
      amount: -amount,
      status: 'completed',
      description: `Transfer to ${recipientUsername}`,
      reference: Transaction.generateReference(),
      paymentMethod: 'internal',
      paymentGateway: 'internal',
      metadata: {
        recipientId: recipient._id,
        recipientUsername,
        note,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      },
      netAmount: -amount,
      balanceBefore: sender.wallet.balance,
      balanceAfter: sender.wallet.balance - amount,
      processedAt: new Date()
    });

    // Create transfer transaction for recipient
    const recipientTransaction = new Transaction({
      userId: recipient._id,
      type: 'transfer',
      amount: amount,
      status: 'completed',
      description: `Transfer from ${req.user.username}`,
      reference: Transaction.generateReference(),
      paymentMethod: 'internal',
      paymentGateway: 'internal',
      metadata: {
        senderId: req.user._id,
        senderUsername: req.user.username,
        note,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      },
      netAmount: amount,
      balanceBefore: recipient.wallet.balance,
      balanceAfter: recipient.wallet.balance + amount,
      processedAt: new Date()
    });

    // Update balances
    sender.wallet.balance -= amount;
    recipient.wallet.balance += amount;

    // Save all changes
    await Promise.all([
      senderTransaction.save(),
      recipientTransaction.save(),
      sender.save(),
      recipient.save()
    ]);

    // Emit wallet update events
    events.walletUpdate(req.user._id, {
      type: 'transfer_sent',
      amount,
      newBalance: sender.wallet.balance,
      recipient: recipientUsername,
      transactionId: senderTransaction.reference
    });

    events.walletUpdate(recipient._id, {
      type: 'transfer_received',
      amount,
      newBalance: recipient.wallet.balance,
      sender: req.user.username,
      transactionId: recipientTransaction.reference
    });

    // Log transfer
    logger.info(`User ${req.user.username} transferred ₹${amount} to ${recipientUsername}`);

    res.json({
      success: true,
      message: 'Transfer successful',
      data: {
        transactionId: senderTransaction.reference,
        amount,
        recipient: recipientUsername,
        newBalance: sender.wallet.balance
      }
    });
  } catch (error) {
    logger.error('Transfer error:', error);
    throw error;
  }
}));

// @route   GET /api/wallet/statistics
// @desc    Get wallet statistics
// @access  Private
router.get('/statistics', authenticateToken, asyncHandler(async (req, res) => {
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

    // Get transaction statistics
    const stats = await Transaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' }
        }
      }
    ]);

    // Get user's current wallet info
    const user = await User.findById(req.user._id);

    // Format statistics
    const formattedStats = {
      period,
      currentBalance: user.wallet.balance,
      totalDeposited: user.wallet.totalDeposited,
      totalWithdrawn: user.wallet.totalWithdrawn,
      totalWon: user.wallet.totalWon,
      referralEarnings: user.referralEarnings,
      transactions: stats.reduce((acc, stat) => {
        acc[stat._id] = {
          count: stat.count,
          totalAmount: stat.totalAmount,
          avgAmount: Math.round(stat.avgAmount * 100) / 100
        };
        return acc;
      }, {})
    };

    res.json({
      success: true,
      data: formattedStats
    });
  } catch (error) {
    logger.error('Get wallet statistics error:', error);
    throw error;
  }
}));

// @route   POST /api/wallet/request-refund
// @desc    Request refund for a transaction
// @access  Private
router.post('/request-refund', authenticateToken, asyncHandler(async (req, res) => {
  const { transactionId, reason } = req.body;

  if (!transactionId || !reason) {
    return res.status(400).json({
      success: false,
      message: 'Transaction ID and reason are required'
    });
  }

  try {
    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId: req.user._id
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Only completed transactions can be refunded'
      });
    }

    if (!transaction.isReversible) {
      return res.status(400).json({
        success: false,
        message: 'This transaction cannot be refunded'
      });
    }

    // Check if refund request already exists
    const existingRefund = await Transaction.findOne({
      'metadata.originalTransactionId': transactionId,
      type: 'refund',
      userId: req.user._id
    });

    if (existingRefund) {
      return res.status(400).json({
        success: false,
        message: 'Refund request already exists for this transaction'
      });
    }

    // Create refund request
    const refundTransaction = new Transaction({
      userId: req.user._id,
      type: 'refund',
      amount: Math.abs(transaction.amount),
      status: 'pending',
      description: `Refund request for ${transaction.description}`,
      reference: Transaction.generateReference(),
      paymentMethod: 'internal',
      paymentGateway: 'internal',
      metadata: {
        originalTransactionId: transactionId,
        reason,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      },
      netAmount: Math.abs(transaction.amount),
      balanceBefore: 0, // Will be updated when processed
      balanceAfter: 0,  // Will be updated when processed
      isReversible: false
    });

    await refundTransaction.save();

    // Log refund request
    logger.info(`User ${req.user.username} requested refund for transaction: ${transactionId}`);

    res.json({
      success: true,
      message: 'Refund request submitted successfully',
      data: {
        refundId: refundTransaction.reference,
        originalTransactionId: transactionId,
        amount: Math.abs(transaction.amount),
        status: 'pending'
      }
    });
  } catch (error) {
    logger.error('Request refund error:', error);
    throw error;
  }
}));

// @route   GET /api/wallet/limits
// @desc    Get wallet transaction limits
// @access  Private
router.get('/limits', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const limits = {
      deposit: {
        min: 10,
        max: 100000,
        daily: 500000
      },
      withdrawal: {
        min: 100,
        max: 50000,
        daily: 100000
      },
      transfer: {
        min: 10,
        max: 10000,
        daily: 50000
      }
    };

    res.json({
      success: true,
      data: limits
    });
  } catch (error) {
    logger.error('Get wallet limits error:', error);
    throw error;
  }
}));

module.exports = router;
