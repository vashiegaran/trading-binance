# Next.js Dashboard Analytics Update Guide

This document outlines all the **new analytics features** you need to add to your existing Next.js dashboard implementation.

---

## Overview of Changes

Your existing dashboard already has basic trade tracking. Now you need to add comprehensive analytics for:

1. **Hour-by-hour decisions** (TRADED vs SKIPPED)
2. **Detailed skip reasons**
3. **Complete trade analytics**
4. **Total USDT balance tracking**

---

## New MongoDB Collections & Fields

### Collection: `hour_decisions` (NEW)

This is a completely new collection that tracks every hourly decision your bot makes.

**Document Structure:**

```typescript
{
  timestamp: Date,
  decision: "TRADED" | "SKIPPED",

  // FOR SKIPPED DECISIONS:
  skipReasons?: [
    {
      reason: string,              // e.g., "LOW_CONFIDENCE", "HOLD_SIGNAL", etc.
      details: {
        // Dynamic based on reason type
        confidence?: number,
        minConfidence?: number,
        threshold?: string,
        signal?: string,
        explanation?: string,
        availableBalance?: number,
        requiredAmount?: number,
        minTradeAmount?: number,
        errorMessage?: string,
        errorCode?: string,
        attemptedQuantity?: number,
        attemptedAmount?: number
      },
      timestamp: Date
    }
  ],

  // FOR TRADED DECISIONS:
  tradeDetails?: {
    signal: string,                // "BUY" or "SELL"
    type: "BUY" | "SELL",
    confidence: number,
    quantity: number,
    price: number,
    amount: number,
    balanceBefore: {
      sol: number,
      usdt: number,
      totalValue: number           // NEW FIELD
    },
    balanceAfter: {
      sol: number,
      usdt: number,
      totalValue: number           // NEW FIELD
    },
    profit?: number,
    orderId?: string,
    fees?: {
      amount: number,
      currency: string
    },
    tradingPair: string
  },

  // ALWAYS PRESENT:
  prediction: {
    signal: "BUY" | "SELL" | "HOLD",
    confidence: number,
    predictedPrice: number,
    reasoning: string[],
    indicators: {
      rsi?: number,
      movingAverage?: number,
      priceMomentum?: number,
      volumeTrend?: "increasing" | "decreasing" | "stable"
    }
  },
  marketData: {
    symbol: string,
    price: number,
    volume24h: number,
    priceChange24h: number,
    priceChangePercent24h: number,
    high24h: number,
    low24h: number,
    timestamp: number
  },
  balances: {
    sol: number,
    usdt: number,
    totalValue: number            // NEW FIELD - Total portfolio value in USDT
  },
  executionTime?: number,         // milliseconds
  errorDetails?: {                // Only if execution failed
    message: string,
    stack?: string,
    timestamp: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

---

## Updated Collection: `bot_snapshots`

**NEW FIELD:**

```typescript
{
  // ... existing fields ...
  balances: {
    sol: number,
    usdt: number,
    totalValue: number            // ADD THIS FIELD - portfolio total
  }
}
```

---

## Updated Collection: `trades`

No changes needed! Your existing structure is fine.

---

## Updated Collection: `hourly_metrics`

**NEW FIELD:**

```typescript
{
  // ... existing fields ...
  balances: {
    sol: number,
    usdt: number,
    totalValue: number            // ADD THIS FIELD
  }
}
```

---

## New Collection: `startup_balances` (NEW)

This collection tracks the initial portfolio balance when the server starts. **Critical for calculating total profit/loss from startup.**

**Document Structure:**

```typescript
{
  timestamp: Date,                 // When server started
  balances: {
    sol: number,
    usdt: number,
    totalValue: number             // Total portfolio value at startup
  },
  solPrice: number,                // SOL price at startup
  createdAt: Date,
  updatedAt: Date
}
```

**Usage:**

- Get the **initial portfolio value** to calculate performance from startup
- Calculate **total profit/loss**: `currentTotalValue - startupTotalValue`
- Calculate **percentage gain/loss**: `((currentTotalValue - startupTotalValue) / startupTotalValue) * 100`
- Track **performance since server restart**

---

## Skip Reason Types

You need to handle these skip reason codes in your dashboard:

| Reason Code                 | Description                        | Common Details                                                      |
| --------------------------- | ---------------------------------- | ------------------------------------------------------------------- |
| `LOW_CONFIDENCE`            | Confidence below minimum threshold | `confidence`, `minConfidence`, `threshold`                          |
| `HOLD_SIGNAL`               | Prediction algorithm returned HOLD | `signal`, `explanation`                                             |
| `INSUFFICIENT_BALANCE_BUY`  | Not enough USDT to buy             | `availableBalance`, `requiredAmount`, `minTradeAmount`              |
| `INSUFFICIENT_BALANCE_SELL` | Not enough SOL to sell             | `availableBalance`, `requiredQuantity`, `minTradeAmount`            |
| `BUY_EXECUTION_ERROR`       | Buy order failed                   | `errorMessage`, `errorCode`, `attemptedQuantity`, `attemptedAmount` |
| `SELL_EXECUTION_ERROR`      | Sell order failed                  | `errorMessage`, `errorCode`, `attemptedQuantity`, `attemptedAmount` |
| `EXECUTION_ERROR`           | General execution failure          | `errorMessage`, `errorStack`                                        |

---

## Dashboard Features to Add

### 1. Hour Decisions Analytics Page

Create a new page to show all hourly decisions:

**Visualizations:**

- **Decision timeline** - Chart showing TRADED vs SKIPPED over time
- **Skip reasons breakdown** - Pie chart/table of skip reason frequencies
- **Decision details table** - Expandable rows with full context

**Key Metrics to Display:**

- Total hours analyzed
- Hours traded vs skipped
- Skip reason distribution
- Average execution time

### 2. Enhanced Trade History

Add these columns to your existing trades table:

- `balanceBefore.totalValue` - Portfolio value before trade
- `balanceAfter.totalValue` - Portfolio value after trade
- `orderId` - Binance order ID

### 3. Portfolio Value Tracking

Add a new card/chart for **total USDT value**:a

- Display `balances.totalValue` from latest `bot_snapshots`
- Show historical portfolio value chart
- Compare against trades to show unrealized gains/losses
- **NEW:** Show profit/loss from startup using `startup_balances` collection
- **NEW:** Display percentage gain/loss since server start

### 4. Skip Reasons Analytics

New component to analyze why trades were skipped:

**Features:**

- Filter by skip reason type
- Show breakdown by date range
- Display detailed context for each skip
- Statistics (e.g., "Confidence too low 45 times in last 7 days")

### 5. Execution Performance

Display execution metrics:

- Average `executionTime` per decision
- Execution time trends over time
- Identify slow executions

---

## API Endpoints to Create

Add these new API routes to your Next.js app:

### 1. `/api/hour-decisions`

Get hourly decisions with filtering:

```typescript
GET /api/hour-decisions?startDate=...&endDate=...&decision=TRADED|SKIPPED&skipReason=...
```

Returns: Array of `hour_decisions` documents

### 2. `/api/skip-reasons-summary`

Aggregate statistics on skip reasons:

```typescript
GET /api/skip-reasons-summary?startDate=...&endDate=...
```

Returns:

```typescript
{
  totalSkips: number,
  reasons: {
    LOW_CONFIDENCE: { count: number, percentage: number },
    HOLD_SIGNAL: { count: number, percentage: number },
    // ... etc
  }
}
```

### 3. `/api/portfolio-value`

Historical portfolio value tracking:

```typescript
GET /api/portfolio-value?startDate=...&endDate=...
```

Returns: Array of portfolio snapshots with `totalValue`

### 4. `/api/startup-balance` (NEW)

**Purpose:** Get the initial portfolio balance when server started

**Instructions:**

- Query the `startup_balances` collection
- Get the first/oldest record (sort by `timestamp: 1`) for the original startup balance
- Return the startup balance document with timestamp, balances (sol, usdt, totalValue), and solPrice
- Return `null` if no startup balance exists

**Response format:**

- Should include: `timestamp`, `balances.sol`, `balances.usdt`, `balances.totalValue`, `solPrice`

### 5. `/api/performance-from-startup` (NEW)

**Purpose:** Calculate performance metrics from startup

**Instructions:**

1. Get the startup balance from `startup_balances` collection (first record sorted by timestamp ascending)
2. Get the current balance from `bot_snapshots` collection (latest record sorted by timestamp descending)
3. Calculate:
   - **Absolute change**: `currentTotalValue - startupTotalValue`
   - **Percentage change**: `((currentTotalValue - startupTotalValue) / startupTotalValue) * 100`
   - **Duration**: Time difference in milliseconds between current and startup timestamps
4. Return both startup and current balances, plus the calculated profit/loss metrics
5. Return `null` if either startup or current balance is missing

**Response format:**

- Should include: `startupBalance` (with timestamp and all balance fields), `currentBalance` (with timestamp and all balance fields), `profitLoss` (with absolute, percentage, and duration)

---

## Component Structure Suggestions

### New Components Needed

1. **`HourDecisionsChart.tsx`**

   - Line chart showing TRADED/SKIPPED over time
   - Color-coded by decision type

2. **`SkipReasonsBreakdown.tsx`**

   - Pie chart showing skip reason distribution
   - Table with counts and percentages

3. **`DecisionDetailsTable.tsx`**

   - Expandable table rows
   - Shows full context: prediction, market data, balances
   - Different view for TRADED vs SKIPPED rows

4. **`PortfolioValueCard.tsx`**

   - Displays current total USDT value
   - Shows change from previous period

5. **`PortfolioValueChart.tsx`**

   - Historical portfolio value line chart
   - Overlay actual trades on the chart

6. **`ExecutionPerformanceChart.tsx`**

   - Bar chart showing execution times
   - Trend line over time

7. **`StartupPerformanceCard.tsx`** (NEW)

   - Shows total profit/loss from startup
   - Displays percentage gain/loss
   - Shows time since server start
   - Compares current vs startup balance

8. **`PortfolioPerformanceChart.tsx`** (NEW)
   - Line chart showing portfolio value over time
   - Highlight startup balance point
   - Show profit/loss zones (green/red)
   - Display annotations for major gains/losses

---

## Database Queries Examples

### Get all hour decisions with filters

```typescript
const decisions = await db
  .collection("hour_decisions")
  .find({
    timestamp: { $gte: startDate, $lte: endDate },
    decision: decisionFilter, // optional
  })
  .sort({ timestamp: -1 })
  .toArray();
```

### Aggregate skip reasons

```typescript
const skipReasons = await db
  .collection("hour_decisions")
  .aggregate([
    { $match: { decision: "SKIPPED" } },
    { $unwind: "$skipReasons" },
    {
      $group: {
        _id: "$skipReasons.reason",
        count: { $sum: 1 },
        latest: { $max: "$timestamp" },
      },
    },
    { $sort: { count: -1 } },
  ])
  .toArray();
```

### Get portfolio value history

```typescript
const portfolioHistory = await db
  .collection("bot_snapshots")
  .find({ timestamp: { $gte: startDate, $lte: endDate } })
  .project({
    timestamp: 1,
    "balances.totalValue": 1,
    "balances.sol": 1,
    "balances.usdt": 1,
  })
  .sort({ timestamp: 1 })
  .toArray();
```

### Get startup balance (first record)

```typescript
const startupBalance = await db
  .collection("startup_balances")
  .findOne({}, { sort: { timestamp: 1 } }); // Get oldest/first startup

// Or get the latest startup (in case of server restarts)
const latestStartup = await db
  .collection("startup_balances")
  .findOne({}, { sort: { timestamp: -1 } }); // Get newest startup
```

### Calculate performance from startup

```typescript
// Get startup balance
const startup = await db
  .collection("startup_balances")
  .findOne({}, { sort: { timestamp: 1 } });

// Get current balance from latest snapshot
const current = await db
  .collection("bot_snapshots")
  .findOne({}, { sort: { timestamp: -1 } });

if (startup && current) {
  const absoluteChange =
    current.balances.totalValue - startup.balances.totalValue;
  const percentageChange = (absoluteChange / startup.balances.totalValue) * 100;
  const duration = current.timestamp.getTime() - startup.timestamp.getTime();

  return {
    startupBalance: startup,
    currentBalance: current,
    profitLoss: {
      absolute: absoluteChange,
      percentage: percentageChange,
      duration: duration, // milliseconds
    },
  };
}
```

---

## Key Takeaways

### Fields to Add Everywhere:

- `balances.totalValue` - Total portfolio value in USDT
- All skip reason fields from `hour_decisions.skipReasons[]`
- All trade detail fields from `hour_decisions.tradeDetails`

### New Collection to Use:

- `startup_balances` - Tracks initial portfolio value when server starts
  - Use to calculate profit/loss from startup
  - Use to show performance percentage since server restart
  - Query with `sort: { timestamp: 1 }` to get first startup

### Important:

1. **Field names must match exactly** as shown above
2. The `hour_decisions` collection is completely new
3. You can use your existing MongoDB connection setup
4. All timestamps are in Date format

### Priority Features:

1. ✅ Display total USDT value (most important)
2. ✅ Show profit/loss from startup (NEW - use `startup_balances`)
3. ✅ Show skip reasons breakdown
4. ✅ Enhanced decision timeline
5. ✅ Portfolio value chart with startup point
6. ⚪ Execution performance tracking

---

## Testing Checklist

- [ ] Can fetch and display hour_decisions
- [ ] Skip reasons display correctly with details
- [ ] Trade details show all new fields
- [ ] Total USDT value shows correctly
- [ ] Portfolio value chart renders historical data
- [ ] Filtering by decision type works
- [ ] Filtering by skip reason works
- [ ] Expandable decision rows work
- [ ] **NEW:** Can fetch startup balance from `startup_balances` collection
- [ ] **NEW:** Profit/loss from startup calculates correctly
- [ ] **NEW:** Performance percentage displays correctly
- [ ] **NEW:** Startup balance point shows on portfolio chart

---

**End of Guide**
