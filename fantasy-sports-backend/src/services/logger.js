const winston = require('winston');
const path = require('path');

const initializeLogger = () => {
  // Define log format
  const logFormat = winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
  );

  // Create logger instance
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'tactics-turf-backend' },
    transports: [
      // Console transport
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }),
      
      // File transport for all logs
      new winston.transports.File({
        filename: path.join(__dirname, '../../logs/combined.log'),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true
      }),
      
      // File transport for error logs
      new winston.transports.File({
        filename: path.join(__dirname, '../../logs/error.log'),
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true
      }),
      
      // File transport for access logs
      new winston.transports.File({
        filename: path.join(__dirname, '../../logs/access.log'),
        level: 'info',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true
      })
    ]
  });

  // Add request logging middleware
  logger.stream = {
    write: (message) => {
      logger.info(message.trim());
    }
  };

  // Handle uncaught exceptions
  logger.exceptions.handle(
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/exceptions.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );

  // Handle unhandled promise rejections
  logger.rejections.handle(
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/rejections.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );

  return logger;
};

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = { initializeLogger };
