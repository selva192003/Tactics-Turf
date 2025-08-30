# Tactics Turf - Fantasy Sports Backend

A comprehensive backend API for the Tactics Turf fantasy sports platform, built with Node.js, Express, and MongoDB.

## 🚀 Features

- **User Management**: Registration, authentication, profile management
- **Match Management**: Live matches, upcoming matches, match details
- **Contest System**: Public/private contests with entry fees and prize pools
- **Fantasy Teams**: Player selection, captain/vice-captain, team validation
- **Real-time Updates**: WebSocket integration for live scores and leaderboards
- **Wallet System**: Deposits, withdrawals, transaction history
- **Payment Integration**: Stripe, Razorpay, UPI support
- **Admin Dashboard**: User management, contest management, analytics
- **Notification System**: Push, email, SMS, and in-app notifications
- **Scoring Engine**: Configurable scoring rules per sport
- **Caching**: Redis-based caching for performance optimization

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 5.x
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis
- **Authentication**: JWT with refresh tokens
- **Real-time**: Socket.IO
- **Validation**: Joi
- **Logging**: Winston
- **File Upload**: Multer
- **Payments**: Stripe, Razorpay
- **Testing**: Jest, Supertest
- **Linting**: ESLint
- **TypeScript**: Support included

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB 5+
- Redis 6+
- npm or yarn

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd fantasy-sports-backend
npm install
```

### 2. Environment Setup

```bash
cp config.env.example .env
# Edit .env with your configuration
```

### 3. Database Setup

```bash
# Start MongoDB
mongod

# Start Redis
redis-server
```

### 4. Run the Application

```bash
# Development mode
npm run dev

# Production mode
npm start

# Test mode
npm test
```

The server will start on `http://localhost:5000`

## 🔧 Configuration

### Environment Variables

Key configuration options in `.env`:

```bash
# Server
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/tactics_turf

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m

# Sports API
SPORTS_API_KEY=your-api-key

# Payment Gateways
STRIPE_SECRET_KEY=your-stripe-key
RAZORPAY_KEY_ID=your-razorpay-key
```

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | User registration |
| POST | `/auth/login` | User login |
| POST | `/auth/refresh` | Refresh JWT token |
| GET | `/auth/me` | Get current user profile |
| PUT | `/auth/profile` | Update user profile |
| POST | `/auth/logout` | User logout |

### Match Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/matches` | Get all matches with filters |
| GET | `/matches/upcoming` | Get upcoming matches |
| GET | `/matches/live` | Get live matches |
| GET | `/matches/:id` | Get match by ID |
| GET | `/matches/:id/contests` | Get contests for a match |

### Contest Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/contests` | Get all contests |
| GET | `/contests/featured` | Get featured contests |
| GET | `/contests/:id` | Get contest by ID |
| POST | `/contests` | Create new contest (Admin) |
| POST | `/contests/:id/join` | Join a contest |
| DELETE | `/contests/:id/leave` | Leave a contest |

### Team Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/teams` | Get user's fantasy teams |
| POST | `/teams` | Create new fantasy team |
| PUT | `/teams/:id` | Update fantasy team |
| POST | `/teams/:id/submit` | Submit fantasy team |
| POST | `/teams/:id/players` | Add player to team |

### Wallet Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/wallet/balance` | Get wallet balance |
| GET | `/wallet/transactions` | Get transaction history |
| POST | `/wallet/deposit` | Deposit money |
| POST | `/wallet/withdraw` | Withdraw money |
| POST | `/wallet/transfer` | Transfer to another user |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/dashboard` | Admin dashboard stats |
| GET | `/admin/users` | Get all users |
| POST | `/admin/users` | Create new user |
| PUT | `/admin/users/:id` | Update user |
| GET | `/admin/contests` | Get all contests |
| POST | `/admin/matches` | Create new match |

## 🗄️ Database Schema

### User Model
- Authentication details (username, email, password)
- Profile information (fullName, phone, avatar)
- Wallet details (balance, transactions)
- Preferences and settings
- Role-based access control

### Match Model
- Match information (teams, venue, timing)
- Live scores and statistics
- Fantasy enablement settings
- Contest limits and deadlines

### Contest Model
- Contest details (name, entry fee, prize pool)
- Participant management
- Leaderboard and rankings
- Prize distribution

### FantasyTeam Model
- Team composition and players
- Captain/vice-captain selection
- Points calculation
- Formation and strategy

### Transaction Model
- Payment details and status
- Gateway integration
- Fee calculations
- Settlement tracking

### Notification Model
- Multi-channel delivery (email, push, SMS, in-app)
- Targeting and scheduling
- Delivery tracking
- User preferences

## 🔐 Authentication & Authorization

### JWT Implementation
- Access tokens (15 minutes)
- Refresh tokens (7 days)
- Secure token storage
- Automatic token refresh

### Role-Based Access Control
- **User**: Basic fantasy sports features
- **Moderator**: Contest management, user moderation
- **Admin**: Full system access, user management
- **Super Admin**: System configuration, admin management

## 📡 Real-time Features

### WebSocket Events
- Match score updates
- Contest leaderboard changes
- User wallet updates
- System notifications
- Live chat (planned)

### Socket.IO Integration
- Authenticated connections
- Room-based messaging
- Event broadcasting
- Connection management

## 💳 Payment Integration

### Supported Gateways
- **Stripe**: International payments
- **Razorpay**: Indian market
- **UPI**: Direct bank transfers

### Payment Flow
1. User initiates payment
2. Gateway integration
3. Payment verification
4. Wallet credit
5. Transaction recording

## 🧪 Testing

### Test Structure
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Test Categories
- Unit tests for models and services
- Integration tests for API endpoints
- Authentication and authorization tests
- Payment flow tests

## 📊 Monitoring & Logging

### Winston Logging
- Multiple log levels
- File and console output
- Log rotation
- Error tracking

### Performance Monitoring
- Request/response logging
- Database query monitoring
- Cache hit/miss tracking
- Error rate monitoring

## 🚀 Deployment

### Docker Support
```bash
# Build image
docker build -t tactics-turf-backend .

# Run container
docker run -p 5000:5000 tactics-turf-backend
```

### Environment-Specific Configs
- Development: Local MongoDB, Redis
- Staging: Cloud databases, limited features
- Production: High-availability setup, monitoring

## 🔒 Security Features

- **Helmet**: Security headers
- **Rate Limiting**: API abuse prevention
- **CORS**: Cross-origin protection
- **Input Validation**: Joi schema validation
- **SQL Injection**: Mongoose protection
- **XSS Protection**: Input sanitization

## 📈 Performance Optimization

- **Redis Caching**: Frequently accessed data
- **Database Indexing**: Optimized queries
- **Connection Pooling**: Database efficiency
- **Compression**: Response size reduction
- **CDN Integration**: Static asset delivery

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔮 Roadmap

- [ ] GraphQL API support
- [ ] Advanced analytics dashboard
- [ ] Machine learning for player recommendations
- [ ] Multi-language support
- [ ] Advanced contest types
- [ ] Social features and leaderboards
- [ ] Mobile app API optimization
- [ ] Advanced payment methods
- [ ] Real-time chat system
- [ ] Advanced notification preferences

---

**Built with ❤️ by the Tactics Turf Team**
