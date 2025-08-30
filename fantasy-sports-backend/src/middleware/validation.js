const Joi = require('joi');

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errorMessage
      });
    }
    
    next();
  };
};

// Validation schemas
const authSchemas = {
  register: Joi.object({
    username: Joi.string()
      .alphanum()
      .min(3)
      .max(30)
      .required()
      .messages({
        'string.alphanum': 'Username must contain only alphanumeric characters',
        'string.min': 'Username must be at least 3 characters long',
        'string.max': 'Username cannot exceed 30 characters',
        'any.required': 'Username is required'
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    password: Joi.string()
      .min(6)
      .required()
      .messages({
        'string.min': 'Password must be at least 6 characters long',
        'any.required': 'Password is required'
      }),
    fullName: Joi.string()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Full name must be at least 2 characters long',
        'string.max': 'Full name cannot exceed 100 characters',
        'any.required': 'Full name is required'
      }),
    phone: Joi.string()
      .pattern(/^[0-9]{10}$/)
      .required()
      .messages({
        'string.pattern.base': 'Phone number must be 10 digits',
        'any.required': 'Phone number is required'
      }),
    dateOfBirth: Joi.date()
      .max('now')
      .required()
      .messages({
        'date.max': 'Date of birth cannot be in the future',
        'any.required': 'Date of birth is required'
      }),
    referralCode: Joi.string().optional()
  }),

  login: Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password is required'
      })
  }),

  forgotPassword: Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      })
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    password: Joi.string()
      .min(6)
      .required()
      .messages({
        'string.min': 'Password must be at least 6 characters long',
        'any.required': 'Password is required'
      })
  })
};

const contestSchemas = {
  create: Joi.object({
    name: Joi.string()
      .min(3)
      .max(100)
      .required(),
    matchId: Joi.string()
      .required(),
    contestType: Joi.string()
      .valid('public', 'private', 'head-to-head', 'multi-entry')
      .required(),
    entryFee: Joi.number()
      .min(0)
      .required(),
    totalSpots: Joi.number()
      .min(2)
      .max(100000)
      .required(),
    prizePool: Joi.number()
      .min(0)
      .required(),
    teamSize: Joi.number()
      .min(1)
      .max(25)
      .required(),
    startTime: Joi.date()
      .greater('now')
      .required(),
    registrationDeadline: Joi.date()
      .less(Joi.ref('startTime'))
      .required(),
    prizeDistribution: Joi.array()
      .items(Joi.object({
        rank: Joi.number().required(),
        prize: Joi.number().required(),
        percentage: Joi.number().required()
      }))
      .min(1)
      .required()
  }),

  update: Joi.object({
    name: Joi.string()
      .min(3)
      .max(100),
    entryFee: Joi.number().min(0),
    totalSpots: Joi.number().min(2).max(100000),
    prizePool: Joi.number().min(0),
    isActive: Joi.boolean(),
    isVisible: Joi.boolean()
  })
};

const teamSchemas = {
  create: Joi.object({
    name: Joi.string()
      .min(3)
      .max(50)
      .required(),
    matchId: Joi.string()
      .required(),
    players: Joi.array()
      .items(Joi.string())
      .min(1)
      .required(),
    captain: Joi.string().required(),
    viceCaptain: Joi.string().required()
  }),

  update: Joi.object({
    name: Joi.string()
      .min(3)
      .max(50),
    players: Joi.array().items(Joi.string()),
    captain: Joi.string(),
    viceCaptain: Joi.string()
  })
};

const walletSchemas = {
  deposit: Joi.object({
    amount: Joi.number()
      .min(10)
      .max(100000)
      .required(),
    paymentMethod: Joi.string()
      .valid('upi', 'card', 'netbanking', 'wallet')
      .required(),
    upiId: Joi.when('paymentMethod', {
      is: 'upi',
      then: Joi.string().required(),
      otherwise: Joi.forbidden()
    })
  }),

  withdraw: Joi.object({
    amount: Joi.number()
      .min(100)
      .max(50000)
      .required(),
    bankDetails: Joi.object({
      accountNumber: Joi.string().required(),
      ifscCode: Joi.string().required(),
      accountHolderName: Joi.string().required()
    }).required()
  })
};

const adminSchemas = {
  createUser: Joi.object({
    username: Joi.string().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    fullName: Joi.string().min(2).max(100).required(),
    phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
    role: Joi.string().valid('user', 'admin', 'moderator').default('user'),
    isActive: Joi.boolean().default(true)
  }),

  updateUser: Joi.object({
    username: Joi.string().min(3).max(30),
    email: Joi.string().email(),
    fullName: Joi.string().min(2).max(100),
    phone: Joi.string().pattern(/^[0-9]{10}$/),
    role: Joi.string().valid('user', 'admin', 'moderator'),
    isActive: Joi.boolean()
  }),

  createMatch: Joi.object({
    externalId: Joi.string().required(),
    title: Joi.string().required(),
    sport: Joi.string().valid('cricket', 'football', 'basketball', 'tennis').required(),
    tournament: Joi.string().required(),
    team1: Joi.object({
      name: Joi.string().required(),
      shortName: Joi.string().required(),
      logo: Joi.string().uri()
    }).required(),
    team2: Joi.object({
      name: Joi.string().required(),
      shortName: Joi.string().required(),
      logo: Joi.string().uri()
    }).required(),
    startTime: Joi.date().required(),
    matchFormat: Joi.string().required(),
    fantasyDeadline: Joi.date().less(Joi.ref('startTime')).required()
  })
};

module.exports = {
  validateRequest,
  authSchemas,
  contestSchemas,
  teamSchemas,
  walletSchemas,
  adminSchemas
};
