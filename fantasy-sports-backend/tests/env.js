// Test environment configuration
process.env.NODE_ENV = 'test';

// Database configuration for tests
process.env.MONGODB_URI = 'mongodb://localhost:27017/tactics_turf_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';

// JWT configuration for tests
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-jwt-secret-key-for-testing-only';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

// API configuration for tests
process.env.SPORTS_API_KEY = 'test-api-key';
process.env.SPORTS_API_URL = 'https://test-api.example.com';

// Payment configuration for tests
process.env.STRIPE_SECRET_KEY = 'sk_test_test_key';
process.env.RAZORPAY_KEY_ID = 'test_razorpay_key';
process.env.RAZORPAY_KEY_SECRET = 'test_razorpay_secret';

// Email and SMS configuration for tests
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '1025';
process.env.SMTP_USER = 'test@example.com';
process.env.SMTP_PASS = 'test_password';

process.env.TWILIO_ACCOUNT_SID = 'test_account_sid';
process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
process.env.TWILIO_PHONE_NUMBER = '+1234567890';

// File upload configuration for tests
process.env.UPLOAD_PATH = './test-uploads';
process.env.MAX_FILE_SIZE = '5242880';
process.env.ALLOWED_FILE_TYPES = 'jpg,jpeg,png,gif,webp';

// Logging configuration for tests
process.env.LOG_LEVEL = 'error';
process.env.LOG_FILE_PATH = './test-logs';

// Rate limiting for tests
process.env.RATE_LIMIT_WINDOW_MS = '1000';
process.env.RATE_LIMIT_MAX_REQUESTS = '1000';

// Feature flags for tests
process.env.ENABLE_PUSH_NOTIFICATIONS = 'false';
process.env.ENABLE_SMS_NOTIFICATIONS = 'false';
process.env.ENABLE_EMAIL_NOTIFICATIONS = 'false';
process.env.ENABLE_SOCIAL_LOGIN = 'false';
process.env.ENABLE_REFERRAL_SYSTEM = 'false';
process.env.ENABLE_ACHIEVEMENT_SYSTEM = 'false';

// Contest configuration for tests
process.env.MAX_CONTEST_ENTRIES_PER_USER = '100';
process.env.MIN_CONTEST_ENTRIES = '1';
process.env.MAX_CONTEST_PRIZE_POOL = '1000000';
process.env.MIN_CONTEST_ENTRY_FEE = '1';

// Team configuration for tests
process.env.MAX_PLAYERS_PER_TEAM = '11';
process.env.MIN_PLAYERS_PER_TEAM = '11';
process.env.MAX_TEAMS_PER_MATCH = '100';
process.env.MAX_TEAMS_PER_USER = '1000';

// Scoring configuration for tests
process.env.CAPTAIN_MULTIPLIER = '2';
process.env.VICE_CAPTAIN_MULTIPLIER = '1.5';
process.env.BONUS_POINTS_ENABLED = 'true';

// Wallet configuration for tests
process.env.MIN_WITHDRAWAL_AMOUNT = '1';
process.env.MAX_WITHDRAWAL_AMOUNT = '1000000';
process.env.WITHDRAWAL_FEE_PERCENTAGE = '0';
process.env.MIN_DEPOSIT_AMOUNT = '1';

// Referral configuration for tests
process.env.REFERRAL_BONUS_AMOUNT = '50';
process.env.REFERRAL_BONUS_PERCENTAGE = '10';
process.env.MAX_REFERRAL_BONUS = '1000';

// Maintenance mode for tests
process.env.MAINTENANCE_MODE = 'false';
process.env.MAINTENANCE_MESSAGE = 'System is under maintenance. Please try again later.';

// Development configuration for tests
process.env.DEBUG = 'false';
process.env.ENABLE_SWAGGER = 'false';
process.env.ENABLE_GRAPHQL_PLAYGROUND = 'false';

// Test-specific configurations
process.env.TEST_TIMEOUT = '10000';
process.env.TEST_DATABASE_NAME = 'tactics_turf_test';
process.env.TEST_REDIS_DB = '1';

// Disable external API calls in tests
process.env.DISABLE_EXTERNAL_APIS = 'true';
process.env.MOCK_EXTERNAL_SERVICES = 'true';

// Test user credentials
process.env.TEST_ADMIN_EMAIL = 'admin@test.com';
process.env.TEST_ADMIN_PASSWORD = 'admin123';
process.env.TEST_USER_EMAIL = 'user@test.com';
process.env.TEST_USER_PASSWORD = 'user123';

// Test payment credentials
process.env.TEST_STRIPE_CARD = '4242424242424242';
process.env.TEST_STRIPE_CVC = '123';
process.env.TEST_STRIPE_EXPIRY = '12/25';

// Test notification settings
process.env.TEST_FIREBASE_TOKEN = 'test-firebase-token';
process.env.TEST_DEVICE_ID = 'test-device-id';

// Performance testing
process.env.TEST_CONCURRENT_USERS = '10';
process.env.TEST_REQUEST_DELAY = '100';
process.env.TEST_MAX_REQUESTS = '1000';
