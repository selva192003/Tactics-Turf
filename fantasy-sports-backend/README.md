# Tactics Turf - Fantasy Sports Backend

A robust, scalable backend API for the Tactics Turf fantasy sports platform, built with Node.js, Express, MongoDB, and Redis.

## 🚀 Features

### Core Functionality
- **User Management**: Secure authentication with JWT, role-based access control
- **Match Management**: Live match data, upcoming matches, and fantasy enablement
- **Contest System**: Public/private contests with entry fees and prize pools
- **Fantasy Teams**: Player selection, captain/vice-captain designation, team validation
- **Real-time Updates**: WebSocket integration for live leaderboards and notifications
- **Wallet System**: Secure transactions, deposits, withdrawals, and balance management
- **Admin Dashboard**: Comprehensive platform management tools
- **Notification System**: Multi-channel notifications (in-app, email, push, SMS)

### Technical Features
- **RESTful API**: Well-structured endpoints with comprehensive documentation
- **Real-time Communication**: Socket.IO for WebSocket connections
- **Caching**: Redis-based caching for improved performance
- **Authentication**: JWT-based auth with refresh tokens and role management
- **Validation**: Request validation using Joi schemas
- **Error Handling**: Centralized error handling with proper HTTP status codes
- **Logging**: Winston-based structured logging
- **Rate Limiting**: API rate limiting for security
- **Security**: Helmet for security headers, CORS configuration

## 🏗️ Architecture

```
src/
├── api/
│   └── routes/           # API route handlers
│       ├── auth.js       # Authentication routes
│       ├── matches.js    # Match management
│       ├── contests.js   # Contest operations
│       ├── teams.js      # Fantasy team management
│       ├── players.js    # Player data
│       ├── wallet.js     # Wallet operations
│       ├── admin.js      # Admin dashboard
│       └── notifications.js # Notification system
├── config/               # Configuration files
│   └── firebase.js      # Firebase configuration
├── middleware/           # Custom middleware
│   ├── auth.js          # Authentication middleware
│   ├── errorHandler.js  # Error handling
│   └── validation.js    # Request validation
├── models/              # Mongoose schemas
│   ├── User.js          # User model
│   ├── Match.js         # Match model
│   ├── Player.js        # Player model
│   ├── Contest.js       # Contest model
│   ├── FantasyTeam.js   # Fantasy team model
│   ├── Transaction.js   # Transaction model
│   └── Notification.js  # Notification model
└── services/            # Business logic services
    ├── logger.js        # Logging service
    ├── redis.js         # Redis operations
    ├── websocket.js     # WebSocket management
    ├── notificationService.js # Notification handling
    └── sportsApi.js     # External sports API integration
```

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis
- **Authentication**: JWT (JSON Web Tokens)
- **Real-time**: Socket.IO
- **Validation**: Joi
- **Logging**: Winston
- **Security**: Helmet, express-rate-limit
- **File Upload**: Multer
- **Scheduling**: node-cron
- **Email**: Nodemailer
- **SMS**: Twilio
- **Compression**: compression

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- MongoDB 5.0 or higher
- Redis 6.0 or higher
- npm or yarn package manager

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd fantasy-sports-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/tactics-turf
   
   # Redis Configuration
   REDIS_URL=redis://localhost:6379
   
   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key
   JWT_REFRESH_SECRET=your-refresh-secret-key
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   
   # External APIs
   SPORTS_API_KEY=your-sports-api-key
   
   # Payment Gateways
   STRIPE_SECRET_KEY=your-stripe-secret-key
   RAZORPAY_KEY_ID=your-razorpay-key-id
   RAZORPAY_KEY_SECRET=your-razorpay-secret
   
   # Email Configuration
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   
   # SMS Configuration
   TWILIO_ACCOUNT_SID=your-twilio-sid
   TWILIO_AUTH_TOKEN=your-twilio-token
   TWILIO_PHONE_NUMBER=your-twilio-phone
   
   # Logging
   LOG_LEVEL=info
   LOG_DIR=logs
   ```

4. **Database Setup**
   ```bash
   # Start MongoDB (if using Docker)
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   
   # Start Redis (if using Docker)
   docker run -d -p 6379:6379 --name redis redis:latest
   ```

5. **Run the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## 📚 API Documentation

### Authentication Endpoints

#### POST `/api/auth/register`
Register a new user account.
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword123",
  "fullName": "John Doe",
  "phone": "+1234567890",
  "referralCode": "FRIEND123"
}
```

#### POST `/api/auth/login`
Authenticate user and get access token.
```json
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

#### POST `/api/auth/refresh`
Refresh access token using refresh token.
```json
{
  "refreshToken": "your-refresh-token"
}
```

### Match Endpoints

#### GET `/api/matches`
Get all matches with filtering and pagination.
```
Query Parameters:
- sport: Filter by sport type
- status: Filter by match status
- page: Page number (default: 1)
- limit: Items per page (default: 20)
- search: Search in match titles
```

#### GET `/api/matches/:id`
Get detailed information about a specific match.

### Contest Endpoints

#### GET `/api/contests`
Get all contests with filtering and pagination.

#### POST `/api/contests/:id/join`
Join a contest (requires authentication).

#### GET `/api/contests/:id/leaderboard`
Get contest leaderboard in real-time.

### Team Management

#### POST `/api/teams`
Create a new fantasy team.
```json
{
  "name": "My Dream Team",
  "matchId": "match123",
  "players": [
    {
      "playerId": "player1",
      "role": "captain"
    },
    {
      "playerId": "player2",
      "role": "vice_captain"
    }
  ]
}
```

### Wallet Operations

#### GET `/api/wallet/balance`
Get user's wallet balance and statistics.

#### POST `/api/wallet/deposit`
Deposit money into wallet.
```json
{
  "amount": 1000,
  "paymentMethod": "upi",
  "upiId": "john@upi"
}
```

#### POST `/api/wallet/withdraw`
Request withdrawal from wallet.
```json
{
  "amount": 500,
  "bankAccount": "1234567890",
  "ifscCode": "SBIN0001234"
}
```

### Admin Endpoints

#### GET `/api/admin/dashboard`
Get admin dashboard statistics (admin only).

#### GET `/api/admin/users`
Get all users with filtering (admin only).

#### POST `/api/admin/users`
Create new user (super admin only).

### Notifications

#### GET `/api/notifications`
Get user notifications with pagination.

#### PUT `/api/notifications/:id/read`
Mark notification as read.

#### GET `/api/notifications/settings`
Get user notification preferences.

## 🔐 Authentication & Authorization

### JWT Token Structure
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "refreshExpiresIn": 604800
}
```

### Role-Based Access Control
- **user**: Regular user with basic permissions
- **admin**: Administrative access to manage contests and users
- **super_admin**: Full system access including user role management

### Protected Routes
Most routes require authentication via the `Authorization` header:
```
Authorization: Bearer <access-token>
```

## 🌐 WebSocket Events

### Client Events
- `joinMatch`: Join match room for real-time updates
- `joinContest`: Join contest room for leaderboard updates
- `privateMessage`: Send private message to another user

### Server Events
- `matchUpdate`: Live match score and status updates
- `leaderboardUpdate`: Real-time contest leaderboard changes
- `notification`: New notification delivery
- `walletUpdate`: Wallet balance changes

## 📊 Database Models

### User Model
- Authentication details (username, email, password)
- Profile information (fullName, phone, avatar, dateOfBirth)
- Wallet management (balance, transactions)
- Preferences and settings
- Referral system

### Match Model
- Match details (teams, venue, start/end time)
- Fantasy settings (deadline, max contests)
- Live data (scores, highlights, streaming)

### Contest Model
- Contest configuration (entry fee, prize pool, spots)
- Participant management
- Leaderboard and scoring
- Status tracking

### FantasyTeam Model
- Team composition and formation
- Player roles (captain, vice-captain)
- Points calculation and ranking
- Submission and locking status

## 🚀 Performance & Scalability

### Caching Strategy
- **Redis Caching**: Frequently accessed data (matches, contests, leaderboards)
- **Query Optimization**: Database indexes on frequently queried fields
- **Pagination**: Efficient data retrieval with cursor-based pagination

### Real-time Updates
- **WebSocket Connections**: Persistent connections for live updates
- **Room Management**: Efficient broadcasting to specific user groups
- **Event Queuing**: Handle high-frequency updates gracefully

### Database Optimization
- **Indexing**: Strategic indexes on query patterns
- **Aggregation**: MongoDB aggregation for complex analytics
- **Connection Pooling**: Efficient database connection management

## 🔒 Security Features

### API Security
- **Rate Limiting**: Prevent API abuse and DDoS attacks
- **Input Validation**: Joi schemas for request validation
- **SQL Injection Protection**: Mongoose ODM with parameterized queries
- **XSS Protection**: Helmet security headers

### Authentication Security
- **JWT Tokens**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **Token Refresh**: Automatic token renewal
- **Session Management**: Secure session handling

### Data Protection
- **Data Encryption**: Sensitive data encryption at rest
- **Access Control**: Role-based permissions
- **Audit Logging**: Comprehensive action logging
- **Input Sanitization**: Clean and validate all inputs

## 📝 Logging & Monitoring

### Logging Levels
- **error**: Application errors and exceptions
- **warn**: Warning conditions
- **info**: General information
- **debug**: Detailed debugging information

### Log Categories
- **Access Logs**: HTTP request/response logging
- **Error Logs**: Application error tracking
- **Performance Logs**: Response time and resource usage
- **Security Logs**: Authentication and authorization events

### Monitoring
- **Health Checks**: `/health` endpoint for system status
- **Performance Metrics**: Response time tracking
- **Error Tracking**: Centralized error collection
- **Resource Usage**: Memory and CPU monitoring

## 🧪 Testing

### Test Structure
```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:integration # Integration tests only
npm run test:coverage # Test coverage report
```

### Test Categories
- **Unit Tests**: Individual function and method testing
- **Integration Tests**: API endpoint testing
- **Database Tests**: Model and query testing
- **WebSocket Tests**: Real-time communication testing

## 🚀 Deployment

### Environment Variables
Configure production environment variables:
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://production-db:27017/tactics-turf
REDIS_URL=redis://production-redis:6379
JWT_SECRET=production-jwt-secret
```

### Docker Deployment
```bash
# Build Docker image
docker build -t tactics-turf-backend .

# Run container
docker run -d -p 5000:5000 --name tactics-turf-backend tactics-turf-backend
```

### PM2 Process Management
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Monitor processes
pm2 monit
```

## 🔧 Development

### Code Style
- **ESLint**: Code linting and style enforcement
- **Prettier**: Code formatting
- **TypeScript**: Type checking (optional)

### Git Workflow
```bash
# Feature development
git checkout -b feature/new-feature
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature

# Bug fixes
git checkout -b fix/bug-description
git add .
git commit -m "fix: resolve bug description"
git push origin fix/bug-description
```

### API Development
1. Define data models in `src/models/`
2. Create route handlers in `src/api/routes/`
3. Add validation schemas in `src/middleware/validation.js`
4. Implement business logic in `src/services/`
5. Add tests for new functionality
6. Update API documentation

## 📚 Additional Resources

### External APIs
- **Sports Data**: Integration with sports APIs for live match data
- **Payment Gateways**: Stripe, Razorpay, UPI integration
- **Email Services**: SMTP, SendGrid, AWS SES
- **SMS Services**: Twilio, AWS SNS

### Third-party Services
- **Monitoring**: Sentry for error tracking
- **Analytics**: Google Analytics, Mixpanel
- **CDN**: Cloudflare, AWS CloudFront
- **Storage**: AWS S3, Google Cloud Storage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Contact the development team
- Check the documentation and API reference

## 🔮 Roadmap

### Upcoming Features
- **GraphQL API**: Alternative to REST API
- **Microservices**: Service decomposition for scalability
- **Event Sourcing**: Event-driven architecture
- **Machine Learning**: Predictive analytics and recommendations
- **Multi-language Support**: Internationalization (i18n)
- **Advanced Analytics**: User behavior and platform insights

### Performance Improvements
- **Database Sharding**: Horizontal scaling
- **CDN Integration**: Global content delivery
- **Load Balancing**: Traffic distribution
- **Auto-scaling**: Dynamic resource allocation

---

**Built with ❤️ for the Tactics Turf fantasy sports platform**
