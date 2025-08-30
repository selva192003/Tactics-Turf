const redis = require('redis');
const logger = require('./logger');

let redisClient = null;

const initializeRedis = async () => {
  try {
    // Create Redis client
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        connectTimeout: 10000,
        lazyConnect: true
      },
      password: process.env.REDIS_PASSWORD,
      database: process.env.REDIS_DB || 0
    });

    // Handle connection events
    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    redisClient.on('end', () => {
      logger.info('Redis client disconnected');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });

    // Connect to Redis
    await redisClient.connect();

    // Test connection
    await redisClient.ping();
    logger.info('Redis connection test successful');

    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    throw error;
  }
};

// Cache operations
const cache = {
  // Set cache with TTL
  set: async (key, value, ttl = 3600) => {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return false;
      }
      
      const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value;
      await redisClient.setEx(key, ttl, serializedValue);
      return true;
    } catch (error) {
      logger.error('Redis set error:', error);
      return false;
    }
  },

  // Get cache
  get: async (key) => {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return null;
      }
      
      const value = await redisClient.get(key);
      if (!value) return null;
      
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      logger.error('Redis get error:', error);
      return null;
    }
  },

  // Delete cache
  del: async (key) => {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return false;
      }
      
      await redisClient.del(key);
      return true;
    } catch (error) {
      logger.error('Redis del error:', error);
      return false;
    }
  },

  // Check if key exists
  exists: async (key) => {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return false;
      }
      
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists error:', error);
      return false;
    }
  },

  // Set cache with custom TTL
  setEx: async (key, ttl, value) => {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return false;
      }
      
      const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value;
      await redisClient.setEx(key, ttl, serializedValue);
      return true;
    } catch (error) {
      logger.error('Redis setEx error:', error);
      return false;
    }
  },

  // Increment counter
  incr: async (key) => {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return null;
      }
      
      return await redisClient.incr(key);
    } catch (error) {
      logger.error('Redis incr error:', error);
      return null;
    }
  },

  // Decrement counter
  decr: async (key) => {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return null;
      }
      
      return await redisClient.decr(key);
    } catch (error) {
      logger.error('Redis decr error:', error);
      return null;
    }
  },

  // Set multiple keys
  mset: async (keyValuePairs, ttl = 3600) => {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return false;
      }
      
      const pipeline = redisClient.multi();
      
      for (const [key, value] of Object.entries(keyValuePairs)) {
        const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value;
        pipeline.setEx(key, ttl, serializedValue);
      }
      
      await pipeline.exec();
      return true;
    } catch (error) {
      logger.error('Redis mset error:', error);
      return false;
    }
  },

  // Get multiple keys
  mget: async (keys) => {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return null;
      }
      
      const values = await redisClient.mGet(keys);
      return values.map(value => {
        if (!value) return null;
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      });
    } catch (error) {
      logger.error('Redis mget error:', error);
      return null;
    }
  }
};

// Leaderboard operations
const leaderboard = {
  // Add score to leaderboard
  addScore: async (key, member, score) => {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return false;
      }
      
      await redisClient.zAdd(key, { score, value: member });
      return true;
    } catch (error) {
      logger.error('Redis leaderboard addScore error:', error);
      return false;
    }
  },

  // Get leaderboard rankings
  getRankings: async (key, start = 0, end = -1, reverse = true) => {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return null;
      }
      
      if (reverse) {
        return await redisClient.zRevRangeWithScores(key, start, end);
      } else {
        return await redisClient.zRangeWithScores(key, start, end);
      }
    } catch (error) {
      logger.error('Redis leaderboard getRankings error:', error);
      return null;
    }
  },

  // Get member rank
  getRank: async (key, member, reverse = true) => {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return null;
      }
      
      if (reverse) {
        return await redisClient.zRevRank(key, member);
      } else {
        return await redisClient.zRank(key, member);
      }
    } catch (error) {
      logger.error('Redis leaderboard getRank error:', error);
      return null;
    }
  },

  // Get member score
  getScore: async (key, member) => {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return null;
      }
      
      return await redisClient.zScore(key, member);
    } catch (error) {
      logger.error('Redis leaderboard getScore error:', error);
      return null;
    }
  },

  // Remove member from leaderboard
  removeMember: async (key, member) => {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return false;
      }
      
      await redisClient.zRem(key, member);
      return true;
    } catch (error) {
      logger.error('Redis leaderboard removeMember error:', error);
      return false;
    }
  },

  // Get leaderboard size
  getSize: async (key) => {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return null;
      }
      
      return await redisClient.zCard(key);
    } catch (error) {
      logger.error('Redis leaderboard getSize error:', error);
      return null;
    }
  }
};

// Pub/Sub operations
const pubsub = {
  // Publish message to channel
  publish: async (channel, message) => {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return false;
      }
      
      const serializedMessage = typeof message === 'object' ? JSON.stringify(message) : message;
      await redisClient.publish(channel, serializedMessage);
      return true;
    } catch (error) {
      logger.error('Redis pubsub publish error:', error);
      return false;
    }
  },

  // Subscribe to channel
  subscribe: async (channel, callback) => {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return false;
      }
      
      await redisClient.subscribe(channel, (message) => {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage);
        } catch {
          callback(message);
        }
      });
      
      return true;
    } catch (error) {
      logger.error('Redis pubsub subscribe error:', error);
      return false;
    }
  },

  // Unsubscribe from channel
  unsubscribe: async (channel) => {
    try {
      if (!redisClient) {
        logger.warn('Redis client not initialized');
        return false;
      }
      
      await redisClient.unsubscribe(channel);
      return true;
    } catch (error) {
      logger.error('Redis pubsub unsubscribe error:', error);
      return false;
    }
  }
};

// Close Redis connection
const closeRedis = async () => {
  try {
    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
  }
};

module.exports = {
  initializeRedis,
  cache,
  leaderboard,
  pubsub,
  closeRedis,
  getClient: () => redisClient
};
