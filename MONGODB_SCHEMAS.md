# MongoDB Schemas

This document contains the complete MongoDB schema definitions for all collections used in the trading bot and dashboard system.

## Table of Contents

1. [trades Collection](#1-trades-collection)
2. [hour_decisions Collection](#2-hour_decisions-collection)
3. [bot_snapshots Collection](#3-bot_snapshots-collection)
4. [hourly_metrics Collection](#4-hourly_metrics-collection)
5. [startup_balances Collection](#5-startup_balances-collection)
6. [users Collection](#6-users-collection-new---for-authentication)
7. [sessions Collection](#7-sessions-collection-new---for-session-management)

---

## 1. **trades** Collection

Stores all executed trades (BUY and SELL operations).

### Schema

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
```

### Indexes

```javascript
// Single field indexes
db.trades.createIndex({ timestamp: -1 });      // Descending for recent trades
db.trades.createIndex({ type: 1 });            // For filtering by trade type
db.trades.createIndex({ symbol: 1 });          // For filtering by trading pair

// Compound index
db.trades.createIndex({ timestamp: -1, type: 1 }); // For filtered time queries
```

### Description

- **Purpose**: Records every BUY and SELL trade executed by the bot
- **Data Source**: Populated by `ProfitTracker.recordBuy()` and `ProfitTracker.recordSell()`
- **Usage**: Trade history, profit/loss calculations, trade analytics

---

## 2. **hour_decisions** Collection

Stores detailed hourly decision records with full analytics context.

### Schema

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
```

### Indexes

```javascript
// Single field indexes
db.hour_decisions.createIndex({ timestamp: -1 });      // Descending for recent decisions
db.hour_decisions.createIndex({ decision: 1 });        // For filtering by decision type

// Compound index
db.hour_decisions.createIndex({ timestamp: -1, decision: 1 }); // For filtered time queries
```

### Description

- **Purpose**: Records complete context of every hourly decision made by the bot
- **Data Source**: Populated by `MongoService.saveHourDecision()`
- **Usage**: Decision analytics, skip reason analysis, algorithm performance tracking, full decision context

---

## 3. **bot_snapshots** Collection

Stores hourly snapshots of bot state.

### Schema

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
```

### Indexes

```javascript
// Single field index
db.bot_snapshots.createIndex({ timestamp: -1 }); // Descending for recent snapshots

// Compound index
db.bot_snapshots.createIndex({ timestamp: -1, botStatus: 1 }); // For filtered time queries with status
```

### Description

- **Purpose**: Hourly snapshots of complete bot state for historical tracking
- **Data Source**: Populated by `MongoService.saveBotSnapshot()`
- **Usage**: Portfolio value tracking over time, historical state analysis, balance progression

---

## 4. **hourly_metrics** Collection

Pre-aggregated hourly metrics for fast dashboard queries.

### Schema

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
```

### Indexes

```javascript
// Single field index
db.hourly_metrics.createIndex({ hour: -1 }); // Descending for recent hours
```

### Description

- **Purpose**: Pre-aggregated hourly metrics for fast dashboard queries without real-time aggregation
- **Data Source**: Populated by `MongoService.aggregateHourlyMetrics()`
- **Usage**: Dashboard charts, time-series analysis, fast aggregated queries
- **Update Frequency**: Should be updated after each hourly decision or periodically

---

## 5. **startup_balances** Collection

Records initial portfolio balance on bot startup.

### Schema

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
```

### Indexes

```javascript
// Single field index
db.startup_balances.createIndex({ timestamp: -1 }); // Descending for latest startup
```

### Description

- **Purpose**: Records the initial portfolio balance when bot starts for profit/loss calculations
- **Data Source**: Populated by `MongoService.saveStartupBalance()` on bot startup
- **Usage**: Portfolio gain/loss calculations, baseline comparison, profit percentage calculations
- **Note**: Multiple records may exist if bot restarts - use the earliest timestamp for initial balance

---

## 6. **users** Collection (NEW - for authentication)

Stores user credentials for dashboard login.

### Schema

```typescript
{
  _id: ObjectId,
  username: string,               // Unique username
  password: string,               // Hashed password (bcrypt)
  createdAt: Date,
  updatedAt: Date,
  lastLogin?: Date                // Last successful login timestamp
}
```

### Indexes

```javascript
// Unique index
db.users.createIndex({ username: 1 }, { unique: true }); // Ensure unique usernames
```

### Description

- **Purpose**: Store user credentials for dashboard authentication
- **Data Source**: Populated manually or via setup script
- **Usage**: User authentication for dashboard access
- **Security**: Passwords must be hashed using bcrypt (salt rounds: 10) before storage
- **Initial User**:
  - Username: `vashie`
  - Password: `35688653` (must be hashed before storage)

---

## 7. **sessions** Collection (NEW - for session management)

Stores active user sessions.

### Schema

```typescript
{
  _id: ObjectId,
  userId: ObjectId,               // Reference to users._id
  sessionToken: string,           // Unique session token
  expiresAt: Date,                // Session expiration
  createdAt: Date,
  lastActivity: Date
}
```

### Indexes

```javascript
// Unique index
db.sessions.createIndex({ sessionToken: 1 }, { unique: true }); // Unique session tokens

// Single field index
db.sessions.createIndex({ userId: 1 }); // For user session lookup

// TTL index (auto-deletes expired sessions)
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired sessions
```

### Description

- **Purpose**: Manage user sessions for dashboard authentication
- **Data Source**: Created on successful login, deleted on logout or expiration
- **Usage**: Session validation for protected routes, tracking active sessions
- **Session Expiration**: Sessions expire after a configurable time (e.g., 24 hours)
- **Security**: 
  - Session tokens should be cryptographically secure random strings
  - TTL index automatically cleans up expired sessions
  - Store session tokens in HTTP-only cookies

---

## Collection Relationships

```
hour_decisions (1) ──< (many) bot_snapshots
  └── hourDecisionId reference

bot_snapshots (1) ──< (1) hourly_metrics
  └── snapshotId reference

users (1) ──< (many) sessions
  └── userId reference

trades (independent)
startup_balances (independent)
```

---

## Database Configuration

### Connection String Format

```
MONGODB_URI=mongodb://localhost:27017/trading_bot
// OR
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trading_bot
```

### Database Name

```
MONGODB_DB_NAME=trading_bot
```

### Recommended Indexes Summary

All collections should have indexes on timestamp fields (descending) for efficient time-based queries:

- `trades`: timestamp, type, symbol, compound (timestamp, type)
- `hour_decisions`: timestamp, decision, compound (timestamp, decision)
- `bot_snapshots`: timestamp, compound (timestamp, botStatus)
- `hourly_metrics`: hour
- `startup_balances`: timestamp
- `users`: username (unique)
- `sessions`: sessionToken (unique), userId, expiresAt (TTL)

---

## Data Flow

### Trading Bot → MongoDB

1. **On Startup**: 
   - `startup_balances` collection gets initial balance

2. **On Each Hourly Decision**:
   - `hour_decisions` collection gets complete decision record
   - `bot_snapshots` collection gets bot state snapshot
   - If trade executed: `trades` collection gets trade record

3. **Periodic Aggregation**:
   - `hourly_metrics` collection gets aggregated metrics

### Dashboard → MongoDB

1. **Authentication**:
   - `users` collection: Verify credentials
   - `sessions` collection: Create/validate sessions

2. **Data Queries**:
   - Read from all collections for analytics
   - Query patterns optimized with indexes

---

## Notes

- All collections use the same database (`trading_bot`)
- Timestamps are stored as MongoDB Date objects
- The bot and dashboard share the same MongoDB instance
- No data synchronization needed - bot writes, dashboard reads
- Collections can be queried independently or joined via references
- Use compound indexes for common query patterns
- TTL indexes automatically clean up expired session data

