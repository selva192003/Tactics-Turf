const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if user still exists and is active
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User account is deactivated'
        });
      }

      req.user = user;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired'
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }
      
      throw error;
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message
    });
  }
};

const authenticateAdmin = async (req, res, next) => {
  try {
    await authenticateToken(req, res, (err) => {
      if (err) return next(err);
      
      if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }
      
      next();
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Admin authentication error',
      error: error.message
    });
  }
};

const authenticateSuperAdmin = async (req, res, next) => {
  try {
    await authenticateToken(req, res, (err) => {
      if (err) return next(err);
      
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Super admin access required'
        });
      }
      
      next();
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Super admin authentication error',
      error: error.message
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        if (user && user.isActive) {
          req.user = user;
        }
      } catch (error) {
        // Token is invalid, but we continue without authentication
        // This is useful for public endpoints that can work with or without auth
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

module.exports = {
  authenticateToken,
  authenticateAdmin,
  authenticateSuperAdmin,
  optionalAuth
};
