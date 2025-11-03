# Skipped Trades Analytics Fix

## Issue Summary
- Logs show many skipped trades
- Analytics dashboard only shows 1 skipped trade
- Need to verify all skipped trades are properly saved and counted

## ✅ Fixes Applied

### 1. Added Analytics Methods to MongoDB Service

Three new methods were added to `src/services/mongodbService.ts`:

#### `getDecisionStatistics(startDate?, endDate?)`
Returns:
- `total`: Total number of decisions
- `traded`: Number of TRADED decisions
- `skipped`: Number of SKIPPED decisions
- `tradedPercent`: Percentage of traded decisions
- `skippedPercent`: Percentage of skipped decisions

```typescript
const stats = await mongoService.getDecisionStatistics();
// Returns: { total: 50, traded: 5, skipped: 45, tradedPercent: 10, skippedPercent: 90 }
```

#### `getSkipReasonsStatistics(startDate?, endDate?)`
Returns an array of skip reasons with their counts, sorted by frequency:
```typescript
[
  { reason: "LOW_CONFIDENCE", count: 30, latest: Date },
  { reason: "HOLD_SIGNAL", count: 10, latest: Date },
  { reason: "INSUFFICIENT_BALANCE_BUY", count: 5, latest: Date }
]
```

#### `getHourDecisions(startDate?, endDate?, decision?, limit?)`
Returns all hour decisions with optional filtering:
```typescript
// Get all skipped decisions
const skipped = await mongoService.getHourDecisions(
  startDate,
  endDate,
  "SKIPPED",
  1000
);

// Get all decisions
const all = await mongoService.getHourDecisions(startDate, endDate);
```

### 2. Improved Logging

Added detailed logging when decisions are saved:
- Logs decision type (TRADED/SKIPPED)
- Logs number of skip reasons for skipped trades
- Logs each skip reason individually for debugging

### 3. Fixed Edge Cases

- Ensured `skipReasons` is always an array (never undefined)
- Added default skip reason for edge cases where signal is unknown

## 🔍 How to Verify

### Option 1: Query MongoDB Directly

```javascript
// Connect to MongoDB and run:
db.hour_decisions.countDocuments({ decision: "SKIPPED" })
db.hour_decisions.countDocuments({ decision: "TRADED" })
db.hour_decisions.countDocuments({})  // Total

// Get all skipped decisions
db.hour_decisions.find({ decision: "SKIPPED" }).sort({ timestamp: -1 })

// Get skip reasons breakdown
db.hour_decisions.aggregate([
  { $match: { decision: "SKIPPED" } },
  { $unwind: "$skipReasons" },
  {
    $group: {
      _id: "$skipReasons.reason",
      count: { $sum: 1 },
      latest: { $max: "$timestamp" }
    }
  },
  { $sort: { count: -1 } }
])
```

### Option 2: Use the New Methods (in code)

```typescript
import { MongoService } from "./services/mongodbService.js";

const mongoService = new MongoService();
await mongoService.connect();

// Get statistics
const stats = await mongoService.getDecisionStatistics();
console.log("Total decisions:", stats.total);
console.log("Traded:", stats.traded);
console.log("Skipped:", stats.skipped);
console.log("Skipped %:", stats.skippedPercent.toFixed(2) + "%");

// Get skip reasons breakdown
const skipReasons = await mongoService.getSkipReasonsStatistics();
console.log("\nSkip Reasons:");
skipReasons.forEach(sr => {
  console.log(`  ${sr.reason}: ${sr.count} times`);
});

// Get all skipped decisions
const skipped = await mongoService.getHourDecisions(
  undefined, // startDate
  undefined, // endDate
  "SKIPPED"  // filter
);
console.log(`\nFound ${skipped.length} skipped decisions in database`);
```

### Option 3: Check Logs

Look for these log messages after each trading cycle:
```
📊 Decision logged: SKIPPED (1 reason)
   └─ Skip reason: LOW_CONFIDENCE
```

## 📊 For Frontend/Dashboard

The dashboard should use these new methods:

1. **Display Total Skipped Count:**
```typescript
const stats = await getDecisionStatistics(startDate, endDate);
// Show: `Skipped: ${stats.skipped} (${stats.skippedPercent.toFixed(1)}%)`
```

2. **Display Skip Reasons Breakdown:**
```typescript
const skipReasons = await getSkipReasonsStatistics(startDate, endDate);
// Show pie chart or list with reason counts
```

3. **Display Hour Decisions Timeline:**
```typescript
const decisions = await getHourDecisions(startDate, endDate);
// Show timeline with TRADED vs SKIPPED markers
```

## 🐛 Common Issues

### Issue: Analytics shows fewer skipped trades than logs

**Possible Causes:**
1. **MongoDB connection issue** - Check if `MONGODB_URI` is configured
2. **Frontend querying wrong collection** - Should query `hour_decisions`, not `trades`
3. **Date filtering too restrictive** - Check date range in queries
4. **Decision field mismatch** - Ensure filtering by `decision: "SKIPPED"` (not `status` or `action`)

**Solution:**
- Check MongoDB connection logs
- Verify `hour_decisions` collection exists and has documents
- Run the verification queries above

### Issue: Skip reasons are empty

**Possible Causes:**
- Edge case where signal validation passes but no skip reason is set
- Bug in strategy logic

**Solution:**
- Fixed: Now ensures `skipReasons` is always an array
- Edge cases now get "UNKNOWN_SIGNAL" reason

## 📝 Collection Structure

The `hour_decisions` collection stores:
```typescript
{
  timestamp: Date,
  decision: "TRADED" | "SKIPPED",
  skipReasons?: [
    {
      reason: string,  // e.g., "LOW_CONFIDENCE", "HOLD_SIGNAL", etc.
      details: any,
      timestamp: Date
    }
  ],
  tradeDetails?: {...},  // Only if TRADED
  prediction: {...},
  marketData: {...},
  balances: {...},
  executionTime?: number
}
```

## ✅ Verification Checklist

- [ ] MongoDB connection is working
- [ ] `hour_decisions` collection exists
- [ ] Total count matches expected number of cycles
- [ ] Skipped count matches logs
- [ ] Skip reasons are being saved
- [ ] Dashboard queries `hour_decisions` collection (not `trades`)
- [ ] Dashboard uses `decision: "SKIPPED"` filter correctly
- [ ] Date ranges in queries are correct

## 🔗 Related Files

- `src/services/mongodbService.ts` - Added new methods
- `src/bot/tradingBot.ts` - Improved logging
- `src/strategies/tradingStrategy.ts` - Fixed edge cases
- `NEXTJS_DASHBOARD_ANALYTICS_UPDATE.md` - Dashboard implementation guide

