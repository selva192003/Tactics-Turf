const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('./logger');

let io = null;

const initializeWebSocket = (server) => {
  try {
    // Initialize Socket.IO with CORS configuration
    io = socketIo(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Authentication middleware
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          // Allow unauthenticated connections for public events
          socket.isAuthenticated = false;
          return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user || !user.isActive) {
          return next(new Error('Authentication failed'));
        }

        socket.userId = user._id.toString();
        socket.username = user.username;
        socket.isAuthenticated = true;
        next();
      } catch (error) {
        logger.error('Socket authentication error:', error);
        return next(new Error('Authentication failed'));
      }
    });

    // Connection handler
    io.on('connection', (socket) => {
      logger.info(`User connected: ${socket.username || 'Anonymous'} (${socket.id})`);

      // Join user to personal room
      if (socket.isAuthenticated) {
        socket.join(`user:${socket.userId}`);
        socket.join('authenticated');
      }

      // Handle joining match rooms
      socket.on('joinMatch', (matchId) => {
        if (!matchId) return;
        
        socket.join(`match:${matchId}`);
        logger.info(`User ${socket.username || 'Anonymous'} joined match room: ${matchId}`);
      });

      // Handle leaving match rooms
      socket.on('leaveMatch', (matchId) => {
        if (!matchId) return;
        
        socket.leave(`match:${matchId}`);
        logger.info(`User ${socket.username || 'Anonymous'} left match room: ${matchId}`);
      });

      // Handle joining contest rooms
      socket.on('joinContest', (contestId) => {
        if (!contestId) return;
        
        socket.join(`contest:${contestId}`);
        logger.info(`User ${socket.username || 'Anonymous'} joined contest room: ${contestId}`);
      });

      // Handle leaving contest rooms
      socket.on('leaveContest', (contestId) => {
        if (!contestId) return;
        
        socket.leave(`contest:${contestId}`);
        logger.info(`User ${socket.username || 'Anonymous'} left contest room: ${contestId}`);
      });

      // Handle private messages
      socket.on('privateMessage', (data) => {
        if (!socket.isAuthenticated || !data.recipientId || !data.message) return;
        
        io.to(`user:${data.recipientId}`).emit('privateMessage', {
          senderId: socket.userId,
          senderName: socket.username,
          message: data.message,
          timestamp: new Date()
        });
      });

      // Handle typing indicators
      socket.on('typing', (data) => {
        if (!socket.isAuthenticated || !data.recipientId) return;
        
        io.to(`user:${data.recipientId}`).emit('typing', {
          userId: socket.userId,
          username: socket.username,
          isTyping: data.isTyping
        });
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        logger.info(`User disconnected: ${socket.username || 'Anonymous'} (${socket.id}) - Reason: ${reason}`);
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`Socket error for user ${socket.username || 'Anonymous'}:`, error);
      });
    });

    logger.info('WebSocket service initialized successfully');
    return io;
  } catch (error) {
    logger.error('Failed to initialize WebSocket service:', error);
    throw error;
  }
};

// Emit functions for different events
const emit = {
  // Emit to all connected clients
  toAll: (event, data) => {
    if (!io) {
      logger.warn('WebSocket not initialized');
      return false;
    }
    
    try {
      io.emit(event, data);
      return true;
    } catch (error) {
      logger.error('Error emitting to all clients:', error);
      return false;
    }
  },

  // Emit to authenticated users only
  toAuthenticated: (event, data) => {
    if (!io) {
      logger.warn('WebSocket not initialized');
      return false;
    }
    
    try {
      io.to('authenticated').emit(event, data);
      return true;
    } catch (error) {
      logger.error('Error emitting to authenticated users:', error);
      return false;
    }
  },

  // Emit to specific user
  toUser: (userId, event, data) => {
    if (!io) {
      logger.warn('WebSocket not initialized');
      return false;
    }
    
    try {
      io.to(`user:${userId}`).emit(event, data);
      return true;
    } catch (error) {
      logger.error(`Error emitting to user ${userId}:`, error);
      return false;
    }
  },

  // Emit to multiple users
  toUsers: (userIds, event, data) => {
    if (!io) {
      logger.warn('WebSocket not initialized');
      return false;
    }
    
    try {
      userIds.forEach(userId => {
        io.to(`user:${userId}`).emit(event, data);
      });
      return true;
    } catch (error) {
      logger.error('Error emitting to multiple users:', error);
      return false;
    }
  },

  // Emit to match room
  toMatch: (matchId, event, data) => {
    if (!io) {
      logger.warn('WebSocket not initialized');
      return false;
    }
    
    try {
      io.to(`match:${matchId}`).emit(event, data);
      return true;
    } catch (error) {
      logger.error(`Error emitting to match ${matchId}:`, error);
      return false;
    }
  },

  // Emit to contest room
  toContest: (contestId, event, data) => {
    if (!io) {
      logger.warn('WebSocket not initialized');
      return false;
    }
    
    try {
      io.to(`contest:${contestId}`).emit(event, data);
      return true;
    } catch (error) {
      logger.error(`Error emitting to contest ${contestId}:`, error);
      return false;
    }
  },

  // Emit to specific room
  toRoom: (room, event, data) => {
    if (!io) {
      logger.warn('WebSocket not initialized');
      return false;
    }
    
    try {
      io.to(room).emit(event, data);
      return true;
    } catch (error) {
      logger.error(`Error emitting to room ${room}:`, error);
      return false;
    }
  }
};

// Specific event emitters
const events = {
  // Match events
  matchUpdate: (matchId, data) => emit.toMatch(matchId, 'matchUpdate', data),
  matchStart: (matchId, data) => emit.toMatch(matchId, 'matchStart', data),
  matchEnd: (matchId, data) => emit.toMatch(matchId, 'matchEnd', data),
  scoreUpdate: (matchId, data) => emit.toMatch(matchId, 'scoreUpdate', data),
  
  // Contest events
  contestUpdate: (contestId, data) => emit.toContest(contestId, 'contestUpdate', data),
  leaderboardUpdate: (contestId, data) => emit.toContest(contestId, 'leaderboardUpdate', data),
  contestResult: (contestId, data) => emit.toContest(contestId, 'contestResult', data),
  
  // User events
  notification: (userId, data) => emit.toUser(userId, 'notification', data),
  walletUpdate: (userId, data) => emit.toUser(userId, 'walletUpdate', data),
  teamUpdate: (userId, data) => emit.toUser(userId, 'teamUpdate', data),
  
  // System events
  systemMaintenance: (data) => emit.toAll('systemMaintenance', data),
  announcement: (data) => emit.toAll('announcement', data)
};

// Get connected users count
const getConnectedUsersCount = () => {
  if (!io) return 0;
  return io.engine.clientsCount;
};

// Get connected users in a room
const getRoomUsersCount = (room) => {
  if (!io) return 0;
  const roomSockets = io.sockets.adapter.rooms.get(room);
  return roomSockets ? roomSockets.size : 0;
};

// Get all connected users
const getConnectedUsers = () => {
  if (!io) return [];
  
  const users = [];
  io.sockets.sockets.forEach((socket) => {
    if (socket.isAuthenticated) {
      users.push({
        id: socket.userId,
        username: socket.username,
        socketId: socket.id
      });
    }
  });
  
  return users;
};

// Close WebSocket connections
const closeWebSocket = () => {
  if (io) {
    io.close();
    logger.info('WebSocket service closed');
  }
};

module.exports = {
  initializeWebSocket,
  emit,
  events,
  getConnectedUsersCount,
  getRoomUsersCount,
  getConnectedUsers,
  closeWebSocket,
  getIO: () => io
};
