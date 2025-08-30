// Test setup configuration
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Setup before all tests
beforeAll(async () => {
  // Start in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect to in-memory database
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

// Cleanup after each test
afterEach(async () => {
  // Clear all collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany();
  }
});

// Cleanup after all tests
afterAll(async () => {
  // Close database connection
  await mongoose.connection.close();
  
  // Stop in-memory server
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Global test utilities
global.testUtils = {
  // Create test user
  createTestUser: async (userData = {}) => {
    const User = require('../src/models/User');
    const defaultUser = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User',
      phone: '+1234567890',
      role: 'user'
    };
    
    const user = new User({ ...defaultUser, ...userData });
    return await user.save();
  },
  
  // Create test match
  createTestMatch: async (matchData = {}) => {
    const Match = require('../src/models/Match');
    const defaultMatch = {
      externalId: 'match123',
      title: 'Test Match',
      sport: 'cricket',
      team1: 'Team A',
      team2: 'Team B',
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      status: 'upcoming',
      fantasyEnabled: true
    };
    
    const match = new Match({ ...defaultMatch, ...matchData });
    return await match.save();
  },
  
  // Create test contest
  createTestContest: async (contestData = {}) => {
    const Contest = require('../src/models/Contest');
    const defaultContest = {
      name: 'Test Contest',
      matchId: 'match123',
      sport: 'cricket',
      type: 'public',
      entryFee: 10,
      spots: 100,
      prizePool: 1000,
      teamSize: 11,
      status: 'upcoming'
    };
    
    const contest = new Contest({ ...defaultContest, ...contestData });
    return await contest.save();
  },
  
  // Generate JWT token for testing
  generateTestToken: (user) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  },
  
  // Mock Redis for testing
  mockRedis: () => {
    const redis = require('../src/services/redis');
    
    // Mock cache methods
    redis.cache.set = jest.fn().mockResolvedValue('OK');
    redis.cache.get = jest.fn().mockResolvedValue(null);
    redis.cache.del = jest.fn().mockResolvedValue(1);
    redis.cache.exists = jest.fn().mockResolvedValue(0);
    
    // Mock leaderboard methods
    redis.leaderboard.addScore = jest.fn().mockResolvedValue(1);
    redis.leaderboard.getRankings = jest.fn().mockResolvedValue([]);
    redis.leaderboard.getRank = jest.fn().mockResolvedValue(1);
    redis.leaderboard.getScore = jest.fn().mockResolvedValue(0);
    
    return redis;
  },
  
  // Mock WebSocket events
  mockWebSocket: () => {
    const websocket = require('../src/services/websocket');
    
    websocket.events.emitToUser = jest.fn();
    websocket.events.emitToAll = jest.fn();
    websocket.events.emitToUsers = jest.fn();
    websocket.events.emitToMatch = jest.fn();
    websocket.events.emitToContest = jest.fn();
    
    return websocket;
  }
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
