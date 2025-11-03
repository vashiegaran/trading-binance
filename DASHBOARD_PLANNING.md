# Next.js Dashboard Planning Document

## Table of Contents

1. [MongoDB Schemas](#mongodb-schemas)
2. [Analytics Planning](#analytics-planning)
3. [Next.js Dashboard Architecture](#nextjs-dashboard-architecture)
4. [Authentication System](#authentication-system)
5. [Dashboard Features](#dashboard-features)
6. [Implementation Steps](#implementation-steps)

---

## MongoDB Schemas

### 1. **trades** Collection

Stores all executed trades (BUY and SELL operations).

```typescript
{
  _id: ObjectId,
  timestamp: Date,              // Trade execution time
  type: "BUY" | "SELL",         // Trade type
  symbol: string,                // Trading pair (e.g., "SOLUSDT")
  quantity: number,              // Amount of SOL traded
  price: number,                 // Price per unit at execution
  amount: number,                // Total USDT amount (quantity * price)
  balanceBefore: {
    sol: number,
    usdt: number
  },
  balanceAfter: {
    sol: number,
    usdt: number
  },
  createdAt: Date,
  updatedAt: Date
}

// Indexes:
// - timestamp: -1 (descending)
// - type: 1
// - symbol: 1
// - { timestamp: -1, type: 1 } (compound)
```

### 2. **hour_decisions** Collection

Stores detailed hourly decision records with full analytics context.

```typescript
{
  _id: ObjectId,
  timestamp: Date,               // Decision timestamp
  decision: "TRADED" | "SKIPPED", // Decision outcome
  skipReasons?: [                // Array of skip reasons (if SKIPPED)
    {
      reason: string,            // Skip reason description
      details: any,              // Additional details object
      timestamp: Date
    }
  ],
  tradeDetails?: {               // Trade information (if TRADED)
    signal: string,              // Trading signal
    type: "BUY" | "SELL",
    confidence: number,          // Algorithm confidence (0-100)
    quantity: number,
    price: number,
    amount: number,
    balanceBefore: {
      sol: number,
      usdt: number,
      totalValue: number
    },
    balanceAfter: {
      sol: number,
      usdt: number,
      totalValue: number
    },
    profit?: number,
    orderId?: string,
    fees?: {
      amount: number,
      currency: string
    },
    tradingPair: string
  },
  prediction: {                  // Algorithm prediction data
    signal: string,              // "BUY", "SELL", or "HOLD"
    confidence: number,
    rsi: number,
    maShort: number,
    maLong: number,
    momentum: number,
    volume: number
  },
  marketData: {                  // Market data at decision time
    symbol: string,
    price: number,
    volume24h: number,
    change24h: number,
    timestamp: Date
  },
  balances: {                     // Portfolio balances
    sol: number,
    usdt: number,
    totalValue: number
  },
  executionTime?: number,         // Execution time in milliseconds
  errorDetails?: {                // Error information (if any)
    message: string,
    stack?: string,
    timestamp: Date
  },
  analytics?: {                   // Detailed analytics (optional)
    previousBalances?: {
      sol: number,
      usdt: number,
      totalValue: number
    },
    previousPrice?: number,
    previousTimestamp?: Date,
    valueChange?: {
      sol: { amount: number, percent: number },
      usdt: { amount: number, percent: number },
      total: { amount: number, percent: number }
    },
    priceChange?: {
      amount: number,
      percent: number
    },
    detailedSkipAnalysis?: string,
    decisionExplanation?: string
  },
  createdAt: Date,
  updatedAt: Date
}

// Indexes:
// - timestamp: -1 (descending)
// - decision: 1
// - { timestamp: -1, decision: 1 } (compound)
```

### 3. **bot_snapshots** Collection

Stores hourly snapshots of bot state.

```typescript
{
  _id: ObjectId,
  timestamp: Date,
  marketData: {
    symbol: string,
    price: number,
    volume24h: number,
    change24h: number,
    timestamp: Date
  },
  balances: {
    sol: number,
    usdt: number,
    totalValue: number
  },
  prediction: {
    signal: string,
    confidence: number,
    rsi: number,
    maShort: number,
    maLong: number,
    momentum: number,
    volume: number
  },
  botStatus: string,              // Bot status at snapshot time
  hourDecisionId: string,        // Reference to hour_decisions._id
  hourDecision: {                 // Embedded decision summary
    decision: "TRADED" | "SKIPPED",
    skipReasons?: Array,
    tradeDetails?: Object
  },
  createdAt: Date
}

// Indexes:
// - timestamp: -1 (descending)
// - { timestamp: -1, botStatus: 1 } (compound)
```

### 4. **hourly_metrics** Collection

Pre-aggregated hourly metrics for fast dashboard queries.

```typescript
{
  _id: ObjectId,
  hour: Date,                     // Hour timestamp (rounded to hour)
  snapshotId: ObjectId,          // Reference to bot_snapshots._id
  decision: {
    decision: "TRADED" | "SKIPPED",
    timestamp: Date,
    hasTrade: boolean
  },
  trades: {
    count: number,                // Total trades in this hour
    buyCount: number,
    sellCount: number,
    volume: number,               // Total trade volume
    totalTradeValue: number,      // Total value of all trades
    buyAmount: number,            // Total spent on buys
    sellAmount: number            // Total received from sells
  },
  profit: {
    amount: number,               // Profit for this hour
    percent: number,              // Profit percentage
    cumulative: number            // Cumulative profit up to this hour
  },
  balances: {
    sol: number,
    usdt: number,
    totalValue: number
  },
  marketPrice: number,
  updatedAt: Date
}

// Indexes:
// - hour: -1 (descending)
```

### 5. **startup_balances** Collection

Records initial portfolio balance on bot startup.

```typescript
{
  _id: ObjectId,
  timestamp: Date,
  balances: {
    sol: number,
    usdt: number,
    totalValue: number
  },
  solPrice: number,               // SOL price at startup
  createdAt: Date,
  updatedAt: Date
}

// Indexes:
// - timestamp: -1 (descending)
```

### 6. **users** Collection (NEW - for authentication)

Stores user credentials for dashboard login.

```typescript
{
  _id: ObjectId,
  username: string,               // Unique username
  password: string,               // Hashed password (bcrypt)
  createdAt: Date,
  updatedAt: Date,
  lastLogin?: Date                // Last successful login timestamp
}

// Indexes:
// - username: 1 (unique)
```

### 7. **sessions** Collection (NEW - for session management)

Stores active user sessions.

```typescript
{
  _id: ObjectId,
  userId: ObjectId,               // Reference to users._id
  sessionToken: string,           // Unique session token
  expiresAt: Date,                // Session expiration
  createdAt: Date,
  lastActivity: Date
}

// Indexes:
// - sessionToken: 1 (unique)
// - userId: 1
// - expiresAt: 1 (TTL index for auto-deletion)
```

---

## Analytics Planning

### Overview

The analytics system will leverage all existing MongoDB collections to provide comprehensive insights into bot performance, trading patterns, and portfolio management.

### 1. **Portfolio Analytics**

#### Current Portfolio Metrics

- **Current Balances**

  - SOL balance
  - USDT balance
  - Total portfolio value (SOL \* current_price + USDT)
  - SOL value in USDT

- **Portfolio Growth**
  - Compare current total value vs startup balance
  - Calculate total gain/loss amount and percentage
  - Time-weighted returns
  - Daily/weekly/monthly portfolio value trends

#### Data Sources:

- `startup_balances` - Initial balance
- `bot_snapshots` - Latest snapshot for current balances
- `hour_decisions` - Latest decision for current state

#### Queries Needed:

```javascript
// Get startup balance
startup_balances.findOne({}, { sort: { timestamp: 1 } });

// Get latest snapshot
bot_snapshots.findOne({}, { sort: { timestamp: -1 } });

// Calculate portfolio change
currentValue - startupBalance.totalValue;
```

### 2. **Trading Performance Analytics**

#### Trade Statistics

- **Overall Statistics**

  - Total trades (buys + sells)
  - Buy count vs sell count
  - Total invested (sum of all BUY amounts)
  - Total returned (sum of all SELL amounts)
  - Net profit/loss
  - Profit percentage
  - Average trade size
  - Average buy price vs average sell price

- **Time-based Analysis**
  - Trades per day/week/month
  - Hourly trading activity
  - Peak trading hours
  - Trading frequency trends

#### Data Sources:

- `trades` collection - All trade records
- `hour_decisions` with tradeDetails - Trade execution context

#### Queries Needed:

```javascript
// Total trades
trades.countDocuments();

// Buy/Sell counts
trades.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }]);

// Total invested/returned
trades.aggregate([
  {
    $group: {
      _id: "$type",
      totalAmount: { $sum: "$amount" },
    },
  },
]);

// Profit calculation
// Matched buy/sell pairs using FIFO
```

### 3. **Decision Analytics**

#### Decision Statistics

- **Decision Breakdown**

  - Total decisions (TRADED vs SKIPPED)
  - Trade rate: TRADED / Total decisions
  - Skip rate: SKIPPED / Total decisions
  - Decision trends over time

- **Skip Reasons Analysis**
  - Most common skip reasons
  - Skip reason frequency
  - Skip reason trends
  - Average skip reasons per skipped decision

#### Data Sources:

- `hour_decisions` collection
- `skipReasons` array within hour_decisions

#### Queries Needed:

```javascript
// Decision statistics (already implemented in mongodbService)
getDecisionStatistics(startDate, endDate);

// Skip reasons statistics (already implemented)
getSkipReasonsStatistics(startDate, endDate);
```

### 4. **Hourly Metrics Analytics**

#### Hourly Performance

- **Per-Hour Metrics**

  - Hourly profit/loss
  - Cumulative profit over time
  - Hourly trade volume
  - Hourly decision outcomes
  - Balance progression by hour

- **Aggregated Metrics**
  - Daily aggregated from hourly metrics
  - Weekly summaries
  - Monthly summaries
  - All-time statistics

#### Data Sources:

- `hourly_metrics` collection - Pre-aggregated data

#### Queries Needed:

```javascript
// Hourly metrics for date range
hourly_metrics
  .find({
    hour: { $gte: startDate, $lte: endDate },
  })
  .sort({ hour: 1 });

// Cumulative profit chart
hourly_metrics.find().sort({ hour: 1 }).project({
  hour: 1,
  "profit.cumulative": 1,
});
```

### 5. **Algorithm Performance Analytics**

#### Prediction Accuracy

- **Signal Analysis**

  - BUY signal accuracy (profit after BUY signals)
  - SELL signal accuracy (profit after SELL signals)
  - Confidence level vs actual outcomes
  - RSI, MA, Momentum indicator effectiveness

- **Algorithm Metrics**
  - Average confidence for successful trades
  - Average confidence for skipped decisions
  - Prediction vs actual outcome correlation

#### Data Sources:

- `hour_decisions.prediction` - Algorithm predictions
- `hour_decisions.tradeDetails` - Actual outcomes
- `hour_decisions.analytics` - Performance context

#### Queries Needed:

```javascript
// Successful trades with high confidence
hour_decisions.find({
  decision: "TRADED",
  "prediction.confidence": { $gte: threshold },
});

// Compare prediction signal with trade outcome
hour_decisions
  .find({
    decision: "TRADED",
  })
  .project({
    "prediction.signal": 1,
    "tradeDetails.type": 1,
    "prediction.confidence": 1,
  });
```

### 6. **Market Data Analytics**

#### Price Correlation

- **Price vs Trading**

  - Price movements vs trade decisions
  - Entry/exit prices
  - Average holding period (if trackable)
  - Best entry/exit price analysis

- **Market Trends**
  - 24h price changes
  - Volume analysis
  - Price volatility vs trade frequency

#### Data Sources:

- `hour_decisions.marketData` - Market data at decision time
- `trades.price` - Execution prices

#### Queries Needed:

```javascript
// Price changes over time
hour_decisions.find().sort({ timestamp: 1 }).project({
  timestamp: 1,
  "marketData.price": 1,
});

// Trades with price context
trades.aggregate([
  {
    $lookup: {
      from: "hour_decisions",
      localField: "timestamp",
      foreignField: "timestamp",
      as: "decision",
    },
  },
  { $unwind: "$decision" },
  {
    $project: {
      price: 1,
      "decision.marketData.price": 1,
    },
  },
]);
```

### 7. **Profit/Loss Analytics**

#### P&L Breakdown

- **Profit Calculation**

  - Closed profit (matched buy/sell pairs - FIFO)
  - Unrealized profit (current holdings value vs cost basis)
  - Overall profit (closed + unrealized)
  - Profit by time period

- **Trade-by-Trade Profit**
  - Individual trade profit tracking
  - Best/worst trades
  - Profit distribution
  - Win rate vs loss rate

#### Data Sources:

- `trades` collection - Calculate matched pairs
- `bot_snapshots.balances` - Current holdings
- `startup_balances` - Cost basis

#### Queries Needed:

```javascript
// FIFO profit calculation (matching buys and sells)
// This requires application-level logic to pair trades

// Unrealized profit
currentHoldingsValue - costBasisOfUnmatchedBuys;

// Overall profit
closedProfit + unrealizedProfit;
```

### 8. **Advanced Analytics**

#### Custom Time Range Analysis

- Date range selection
- Compare different time periods
- Performance by day of week
- Performance by hour of day

#### Risk Metrics

- Maximum drawdown
- Sharpe ratio (if sufficient data)
- Risk-adjusted returns
- Volatility analysis

#### Operational Metrics

- Execution time trends
- Error rate
- Bot uptime
- Average time between trades

---

## Next.js Dashboard Architecture

### Project Structure

```
dashboard/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Login page (public)
│   ├── dashboard/
│   │   ├── layout.tsx            # Protected layout (requires auth)
│   │   ├── page.tsx              # Main dashboard page
│   │   ├── analytics/
│   │   │   └── page.tsx          # Detailed analytics page
│   │   ├── trades/
│   │   │   └── page.tsx          # Trade history page
│   │   └── settings/
│   │       └── page.tsx          # Settings page
│   └── api/
│       ├── auth/
│       │   ├── login/
│       │   │   └── route.ts      # Login API endpoint
│       │   ├── logout/
│       │   │   └── route.ts      # Logout API endpoint
│       │   └── session/
│       │       └── route.ts      # Session validation
│       └── data/
│           ├── portfolio/
│           │   └── route.ts      # Portfolio data endpoint
│           ├── trades/
│           │   └── route.ts      # Trades data endpoint
│           ├── decisions/
│           │   └── route.ts      # Decisions data endpoint
│           ├── metrics/
│           │   └── route.ts      # Hourly metrics endpoint
│           └── analytics/
│               └── route.ts      # Aggregated analytics
├── lib/
│   ├── mongodb.ts                # MongoDB connection utility
│   ├── auth.ts                   # Authentication utilities
│   └── queries.ts                # Database query functions
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx         # Login form component
│   │   └── ProtectedRoute.tsx   # Route protection wrapper
│   ├── dashboard/
│   │   ├── PortfolioCard.tsx    # Portfolio overview card
│   │   ├── ProfitChart.tsx      # Profit/loss chart
│   │   ├── TradeTable.tsx        # Trade history table
│   │   ├── DecisionStats.tsx    # Decision statistics
│   │   └── MetricsChart.tsx     # Hourly metrics chart
│   └── ui/                       # Reusable UI components
├── types/
│   └── database.ts               # TypeScript types matching MongoDB schemas
└── public/                       # Static assets
```

### Technology Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Database**: MongoDB (same database as trading bot)
- **Authentication**: Session-based with cookies
- **Password Hashing**: bcrypt
- **UI Library**: React, Tailwind CSS (or your preferred UI library)
- **Charts**: Recharts or Chart.js
- **Date Handling**: date-fns or dayjs

---

## Authentication System

### User Credentials

- **Username**: `vashie`
- **Password**: `35688653`
- **Storage**: MongoDB `users` collection

### Authentication Flow

#### 1. **User Registration/Setup** (One-time)

- Create user document in `users` collection
- Hash password using bcrypt (salt rounds: 10)
- Store in MongoDB

#### Setup Script Logic:

```javascript
// Pseudo-code (NOT implementation)
const bcrypt = require("bcrypt");

const username = "vashie";
const plainPassword = "35688653";
const hashedPassword = await bcrypt.hash(plainPassword, 10);

await db.collection("users").insertOne({
  username: username,
  password: hashedPassword,
  createdAt: new Date(),
  updatedAt: new Date(),
});
```

#### 2. **Login Process**

1. User submits username and password on `/` (login page)
2. POST to `/api/auth/login`
3. Server queries `users` collection by username
4. Compare submitted password with stored hash using bcrypt
5. If valid:
   - Generate unique session token
   - Create session document in `sessions` collection
   - Set HTTP-only cookie with session token
   - Return success response
6. If invalid:
   - Return 401 Unauthorized

#### 3. **Session Management**

- Session token stored in HTTP-only cookie
- Session document stored in MongoDB `sessions` collection
- Session expires after configurable time (e.g., 24 hours)
- TTL index on `sessions.expiresAt` for automatic cleanup
- Middleware validates session on protected routes

#### 4. **Logout Process**

1. User clicks logout
2. POST to `/api/auth/logout`
3. Delete session document from MongoDB
4. Clear session cookie
5. Redirect to login page

#### 5. **Protected Routes**

- All routes under `/dashboard/*` require authentication
- Middleware checks for valid session cookie
- If no valid session, redirect to login page
- Session validation on each request

### Security Considerations

1. **Password Security**

   - Never store plain text passwords
   - Use bcrypt for hashing (salt rounds: 10)
   - Passwords never sent in URL parameters

2. **Session Security**

   - HTTP-only cookies (prevent XSS)
   - Secure cookies (HTTPS only in production)
   - Session tokens are random and unique
   - TTL index auto-deletes expired sessions

3. **API Security**

   - Rate limiting on login endpoint
   - CORS configuration
   - Input validation
   - SQL/NoSQL injection prevention (MongoDB driver handles this)

4. **Additional Security** (Future Enhancements)
   - CSRF protection
   - IP-based rate limiting
   - Login attempt logging
   - Account lockout after failed attempts
   - Password reset functionality

---

## Dashboard Features

### 1. **Login Page** (`/`)

- Clean, centered login form
- Username and password fields
- Submit button
- Error message display
- Redirect to dashboard on success

### 2. **Main Dashboard** (`/dashboard`)

- **Portfolio Overview**

  - Current balances (SOL, USDT, Total Value)
  - Portfolio gain/loss since startup
  - Percentage change

- **Quick Stats Cards**

  - Total trades (buy + sell)
  - Total profit/loss
  - Trade success rate
  - Average trade value

- **Profit/Loss Chart**

  - Line chart showing cumulative profit over time
  - X-axis: Date/Time
  - Y-axis: Profit in USDT
  - Show startup balance as baseline

- **Recent Activity**
  - Last 10 hour decisions
  - Last 10 trades
  - Recent skip reasons (if any)

### 3. **Analytics Page** (`/dashboard/analytics`)

- **Date Range Selector**

  - Custom date range picker
  - Preset ranges (Today, 7 days, 30 days, All time)

- **Decision Analytics**

  - Decision breakdown pie chart (TRADED vs SKIPPED)
  - Skip reasons bar chart
  - Decision trends over time

- **Trading Performance**

  - Trade count by type (Buy vs Sell)
  - Total invested vs total returned
  - Net profit/loss
  - Profit margin percentage

- **Algorithm Performance**

  - Average confidence for trades
  - Confidence distribution chart
  - Signal accuracy metrics

- **Market Correlation**
  - Price chart with trade markers
  - Volume analysis
  - Price change vs trade decisions

### 4. **Trades Page** (`/dashboard/trades`)

- **Trade History Table**

  - Sortable columns (Date, Type, Symbol, Quantity, Price, Amount)
  - Pagination
  - Filter by type (BUY/SELL)
  - Search functionality

- **Trade Details**

  - Expandable rows for full trade details
  - Balance before/after
  - Associated hour decision link

- **Trade Statistics**
  - Total trades summary
  - Buy/Sell counts
  - Total invested/returned
  - Average trade size

### 5. **Hour Decisions Page** (`/dashboard/decisions`)

- **Decision Timeline**

  - Chronological list of all hour decisions
  - Filter by decision type (TRADED/SKIPPED)
  - Date range filter

- **Decision Details**
  - Full decision context
  - Prediction data
  - Market data at time of decision
  - Skip reasons (if skipped)
  - Trade details (if traded)
  - Analytics data

### 6. **Settings Page** (`/dashboard/settings`)

- **User Settings**

  - Change password (future)
  - Logout button

- **Dashboard Preferences**
  - Theme selection (future)
  - Date format preferences
  - Chart preferences

---

## Implementation Steps

### Phase 1: Project Setup

1. **Initialize Next.js Project**

   - Create new Next.js app with TypeScript
   - Install dependencies (mongodb, bcrypt, etc.)
   - Set up project structure

2. **Database Connection**

   - Create MongoDB connection utility
   - Use same MongoDB URI as trading bot
   - Test connection

3. **Environment Variables**
   - Add MONGODB_URI to .env
   - Add session secret for cookies
   - Add session expiry time

### Phase 2: Authentication

1. **Create Users Collection Setup**

   - Create setup script to add user credentials
   - Hash password with bcrypt
   - Insert into users collection

2. **Implement Login API**

   - Create `/api/auth/login` endpoint
   - Password verification
   - Session creation
   - Cookie setting

3. **Implement Session Management**

   - Create sessions collection
   - Session validation middleware
   - Logout endpoint

4. **Create Login UI**
   - Login form component
   - Form validation
   - Error handling
   - Redirect logic

### Phase 3: Protected Routes

1. **Create Protected Layout**

   - Dashboard layout with auth check
   - Session validation middleware
   - Redirect to login if unauthorized

2. **Implement Route Protection**
   - Protect all /dashboard/\* routes
   - Session check on page load
   - Client-side auth state management

### Phase 4: Data API Endpoints

1. **Portfolio Endpoint**

   - `/api/data/portfolio`
   - Get current balances
   - Calculate portfolio metrics
   - Compare with startup balance

2. **Trades Endpoint**

   - `/api/data/trades`
   - Get trades with filters
   - Pagination support
   - Sorting support

3. **Decisions Endpoint**

   - `/api/data/decisions`
   - Get hour decisions
   - Filter by date range and type
   - Include skip reasons

4. **Metrics Endpoint**

   - `/api/data/metrics`
   - Get hourly metrics
   - Aggregate data
   - Date range filtering

5. **Analytics Endpoint**
   - `/api/data/analytics`
   - Aggregated statistics
   - Decision breakdown
   - Profit/loss calculations

### Phase 5: Dashboard UI Components

1. **Portfolio Overview**

   - Create PortfolioCard component
   - Display current balances
   - Show gain/loss

2. **Charts**

   - Install charting library
   - Create ProfitChart component
   - Create DecisionStats chart
   - Create MetricsChart component

3. **Tables**

   - Create TradeTable component
   - Implement sorting and pagination
   - Add filters

4. **Layout**
   - Create dashboard layout
   - Add navigation
   - Add header with user info and logout

### Phase 6: Pages Implementation

1. **Main Dashboard Page**

   - Combine all overview components
   - Add quick stats
   - Add recent activity

2. **Analytics Page**

   - Implement date range selector
   - Add all analytics components
   - Implement filtering

3. **Trades Page**

   - Implement trade table
   - Add search and filters
   - Add trade details modal

4. **Settings Page**
   - Basic settings UI
   - Logout functionality

### Phase 7: Testing & Refinement

1. **Testing**

   - Test authentication flow
   - Test all API endpoints
   - Test UI components
   - Test data accuracy

2. **Performance Optimization**

   - Add caching where appropriate
   - Optimize database queries
   - Add loading states
   - Add error boundaries

3. **UI/UX Refinement**
   - Improve styling
   - Add loading indicators
   - Add error messages
   - Add empty states

### Phase 8: Deployment

1. **Production Setup**

   - Configure production environment variables
   - Set up production MongoDB connection
   - Configure secure cookies
   - Set up CORS

2. **Deployment**
   - Deploy to Vercel (recommended for Next.js)
   - Or deploy to your preferred hosting
   - Set up domain and SSL

---

## Data Flow Architecture

### Authentication Flow

```
User → Login Form → /api/auth/login → MongoDB (users collection)
                                      ↓
                            Verify Password (bcrypt)
                                      ↓
                            Create Session → MongoDB (sessions collection)
                                      ↓
                            Set Cookie → Response → Redirect to /dashboard
```

### Dashboard Data Flow

```
Dashboard Page → API Endpoint (/api/data/*) → MongoDB Query
                                              ↓
                                    Process Data
                                              ↓
                                    Return JSON
                                              ↓
                                    Component Renders Data
```

### Session Validation Flow

```
Protected Route → Middleware → Check Cookie → Validate Session (MongoDB)
                                            ↓
                            Valid: Render Page
                            Invalid: Redirect to Login
```

---

## Database Query Patterns

### Portfolio Data

```javascript
// Get startup balance
const startupBalance = await startupBalances.findOne(
  {},
  { sort: { timestamp: 1 } }
);

// Get latest snapshot
const latestSnapshot = await bot_snapshots.findOne(
  {},
  { sort: { timestamp: -1 } }
);

// Calculate metrics
const portfolioChange =
  latestSnapshot.balances.totalValue - startupBalance.balances.totalValue;
```

### Trade Statistics

```javascript
// Total trades
const totalTrades = await trades.countDocuments();

// Buy/Sell breakdown
const tradeBreakdown = await trades.aggregate([
  {
    $group: {
      _id: "$type",
      count: { $sum: 1 },
      totalAmount: { $sum: "$amount" },
    },
  },
]);

// Trade history with pagination
const tradeHistory = await trades
  .find({})
  .sort({ timestamp: -1 })
  .skip((page - 1) * limit)
  .limit(limit)
  .toArray();
```

### Decision Analytics

```javascript
// Decision statistics (using existing method)
const stats = await mongoService.getDecisionStatistics(startDate, endDate);

// Skip reasons (using existing method)
const skipReasons = await mongoService.getSkipReasonsStatistics(
  startDate,
  endDate
);

// Hour decisions with filters
const decisions = await mongoService.getHourDecisions(
  startDate,
  endDate,
  decisionType,
  limit
);
```

### Hourly Metrics

```javascript
// Get hourly metrics for date range
const metrics = await hourly_metrics
  .find({
    hour: {
      $gte: startDate,
      $lte: endDate,
    },
  })
  .sort({ hour: 1 })
  .toArray();
```

---

## Notes

### MongoDB Connection

- Use the same MongoDB database as the trading bot
- Share the same `MONGODB_URI` environment variable
- All collections are in the same database
- No need for data synchronization - bot writes directly, dashboard reads

### Real-time Updates

- Dashboard reads current data from MongoDB
- No real-time updates by default (refresh page to see new data)
- Future: Add WebSocket or Server-Sent Events for real-time updates

### Data Freshness

- Bot writes data hourly (after each decision)
- Dashboard shows data as of last bot execution
- Consider adding "last updated" timestamp

### Performance Considerations

- Use `hourly_metrics` collection for faster aggregated queries
- Add indexes as specified in schema definitions
- Use pagination for large result sets
- Consider caching frequently accessed data

---

## Summary

This planning document provides:

1. ✅ **Complete MongoDB schemas** for all existing collections plus new authentication collections
2. ✅ **Detailed analytics planning** covering all aspects of bot performance analysis
3. ✅ **Next.js dashboard architecture** with full project structure
4. ✅ **Authentication system** with username/password stored in MongoDB
5. ✅ **Implementation roadmap** broken into phases
6. ✅ **Data flow patterns** and query examples

The dashboard will connect to the same MongoDB database used by the trading bot, allowing real-time viewing of bot performance and trading analytics without requiring data synchronization.
