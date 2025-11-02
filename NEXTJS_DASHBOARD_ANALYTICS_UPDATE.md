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

Add a new card/chart for **total USDT value**:

- Display `balances.totalValue` from latest `bot_snapshots`
- Show historical portfolio value chart
- Compare against trades to show unrealized gains/losses

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

---

## Key Takeaways

### Fields to Add Everywhere:

- `balances.totalValue` - Total portfolio value in USDT
- All skip reason fields from `hour_decisions.skipReasons[]`
- All trade detail fields from `hour_decisions.tradeDetails`

### Important:

1. **Field names must match exactly** as shown above
2. The `hour_decisions` collection is completely new
3. You can use your existing MongoDB connection setup
4. All timestamps are in Date format

### Priority Features:

1. ✅ Display total USDT value (most important)
2. ✅ Show skip reasons breakdown
3. ✅ Enhanced decision timeline
4. ✅ Portfolio value chart
5. ⚪ Execution performance tracking

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

---

**End of Guide**
