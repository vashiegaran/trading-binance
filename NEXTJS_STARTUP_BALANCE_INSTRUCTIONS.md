# Next.js Dashboard: Startup Balance & Portfolio Tracking Instructions

## Overview

The bot now records your **total portfolio value** when the server starts. This allows your Next.js dashboard to display:

1. **Total Money Overall** - Complete portfolio value (SOL + USDT)
2. **Profit/Loss from Startup** - How much you've gained or lost since server start
3. **Percentage Performance** - Performance percentage since startup

---

## What Data is Available

### New MongoDB Collection: `startup_balances`

This collection stores the initial portfolio balance when your server starts.

**Contains:**

- Timestamp of when server started
- SOL balance at startup
- USDT balance at startup
- Total portfolio value at startup (SOL value + USDT)
- SOL price at startup time

---

## What to Display in Your Dashboard

### 1. Current Total Portfolio Value

**What to show:**

- Display the current total portfolio value (from latest `bot_snapshots`)
- Show it prominently as a large card/section
- Format: "$1,234.56 USDT" or similar

**Where to get data:**

- Query `bot_snapshots` collection
- Get the latest record (sort by `timestamp` descending)
- Use `balances.totalValue` field

**Display format:**

- Large, prominent number
- Clear label: "Total Portfolio Value" or "Current Balance"
- Include timestamp of last update

---

### 2. Startup Balance Reference

**What to show:**

- Display the startup balance for reference
- Show it alongside current balance for comparison
- Format: "Started with: $1,000.00 USDT"

**Where to get data:**

- Query `startup_balances` collection
- Get the first/oldest record (sort by `timestamp` ascending)
- Use `balances.totalValue` field

**Display format:**

- Smaller text, reference info
- Label: "Startup Balance" or "Started With"
- Include timestamp of when server started

---

### 3. Profit/Loss from Startup

**What to calculate and show:**

- **Absolute profit/loss**: Current total value minus startup total value
- **Percentage gain/loss**: ((Current - Startup) / Startup) × 100
- **Duration**: How long since server started (in days, hours, or readable format)

**Calculation:**

1. Get startup balance from `startup_balances` (first record)
2. Get current balance from `bot_snapshots` (latest record)
3. Calculate difference: `currentTotalValue - startupTotalValue`
4. Calculate percentage: `((currentTotalValue - startupTotalValue) / startupTotalValue) × 100`
5. Calculate duration: Current timestamp minus startup timestamp

**Display format:**

- Show positive values in green (profits)
- Show negative values in red (losses)
- Format: "+$234.56 (+23.45%)" or "-$50.00 (-5.00%)"
- Include time: "Since server start: 3 days ago"

---

### 4. Portfolio Value Chart

**What to show:**

- Historical portfolio value over time
- Line chart showing `balances.totalValue` from `bot_snapshots`
- Highlight the startup point on the chart

**Instructions:**

1. Query `bot_snapshots` collection for historical data
2. Extract `timestamp` and `balances.totalValue` for each record
3. Sort by timestamp ascending
4. Plot on a line chart
5. Add a marker/annotation at the startup balance point
6. Color code: green above startup value, red below startup value

**Chart features:**

- X-axis: Time (dates/timestamps)
- Y-axis: Portfolio value in USDT
- Show grid lines for easy reading
- Add tooltip showing exact values on hover

---

### 5. Balance Breakdown Card

**What to show:**

- Current SOL balance and its USD value
- Current USDT balance
- Total portfolio value (sum of both)

**Where to get data:**

- Latest record from `bot_snapshots`
- Fields: `balances.sol`, `balances.usdt`, `balances.totalValue`
- Current SOL price from `marketData.price`

**Display format:**

- Card with three sections:
  - SOL: "0.5000 SOL ($150.00)"
  - USDT: "850.00 USDT"
  - Total: "$1,000.00 USDT"

---

## API Endpoints to Create

### Endpoint 1: Get Startup Balance

**Purpose:** Fetch the initial portfolio balance when server started

**Instructions:**

- Create API route: `/api/startup-balance`
- Query `startup_balances` collection
- Find first record (sort by `timestamp` ascending)
- Return the document with all balance fields and timestamp
- Return `null` if no startup balance exists

**Response should include:**

- `timestamp`
- `balances.sol`
- `balances.usdt`
- `balances.totalValue`
- `solPrice`

---

### Endpoint 2: Get Performance from Startup

**Purpose:** Calculate and return profit/loss metrics from startup

**Instructions:**

1. Fetch startup balance from `startup_balances` (first record, sorted by timestamp ascending)
2. Fetch current balance from `bot_snapshots` (latest record, sorted by timestamp descending)
3. Calculate absolute change: `currentTotalValue - startupTotalValue`
4. Calculate percentage change: `((currentTotalValue - startupTotalValue) / startupTotalValue) × 100`
5. Calculate duration: Difference between timestamps in milliseconds
6. Return both balances plus calculated metrics
7. Return `null` if either balance is missing

**Response should include:**

- `startupBalance` (with timestamp and all balance fields)
- `currentBalance` (with timestamp and all balance fields)
- `profitLoss.absolute` (dollar amount)
- `profitLoss.percentage` (percentage change)
- `profitLoss.duration` (milliseconds since startup)

---

## Components to Create

### Component 1: TotalPortfolioValueCard

**Purpose:** Display current total portfolio value prominently

**Instructions:**

- Fetch latest balance from `/api/portfolio-value` or `bot_snapshots`
- Display `balances.totalValue` as large, prominent number
- Show label: "Total Portfolio Value"
- Show last updated timestamp
- Style it as a hero/metric card

---

### Component 2: StartupPerformanceCard

**Purpose:** Show profit/loss from startup

**Instructions:**

- Fetch data from `/api/performance-from-startup`
- Display absolute profit/loss (with + or - sign)
- Display percentage gain/loss (with + or - sign and % symbol)
- Color code: green for positive, red for negative
- Show duration: "Since server start: X days ago"
- Display startup balance for reference

---

### Component 3: PortfolioValueChart

**Purpose:** Historical portfolio value visualization

**Instructions:**

- Fetch historical data from `bot_snapshots` collection
- Plot line chart with:
  - X-axis: Timestamps
  - Y-axis: `balances.totalValue` values
- Add startup balance point as special marker/annotation
- Color code line: green when above startup, red when below
- Add tooltips showing exact values
- Use a charting library (Chart.js, Recharts, etc.)

---

### Component 4: BalanceBreakdownCard

**Purpose:** Show detailed balance breakdown

**Instructions:**

- Fetch latest snapshot from `bot_snapshots`
- Display three values:
  - SOL balance and its USD equivalent
  - USDT balance
  - Total value (sum of both)
- Format numbers nicely with commas and decimals
- Show in a card or grid layout

---

## Where to Place These Components

### Suggested Layout:

1. **Dashboard Home Page:**

   - `TotalPortfolioValueCard` - Top, center (hero section)
   - `StartupPerformanceCard` - Right side, prominent
   - `PortfolioValueChart` - Below, full width
   - `BalanceBreakdownCard` - Sidebar or below chart

2. **Portfolio Page (if separate):**
   - All components grouped together
   - Historical data table
   - Performance metrics

---

## Key Points to Remember

1. **Always use `totalValue`** from balances - this is the calculated total (SOL value + USDT)

2. **Startup balance is in `startup_balances` collection** - Query with `sort: { timestamp: 1 }` to get the first/oldest record

3. **Current balance is in `bot_snapshots` collection** - Query with `sort: { timestamp: -1 }` to get the latest record

4. **Handle null cases** - Server might not have started yet, or MongoDB might not be connected

5. **Format numbers nicely** - Use thousand separators, 2 decimal places for USDT, 4+ for SOL

6. **Color code profit/loss** - Green for gains, red for losses (standard trading convention)

7. **Show timestamps** - Help users understand when data was last updated

---

## Testing Checklist

- [ ] Can fetch and display startup balance
- [ ] Current portfolio value displays correctly
- [ ] Profit/loss calculation is accurate
- [ ] Percentage calculation is correct
- [ ] Duration calculation works properly
- [ ] Chart displays historical portfolio value
- [ ] Startup point is marked on chart
- [ ] Colors are correct (green/red)
- [ ] Numbers are formatted nicely
- [ ] Handles missing data gracefully
- [ ] Updates when new data is available

---

## Priority Implementation Order

1. **TotalPortfolioValueCard** - Most important, shows current balance
2. **StartupPerformanceCard** - Shows profit/loss from startup
3. **PortfolioValueChart** - Visual representation of performance
4. **BalanceBreakdownCard** - Detailed breakdown (nice to have)

---

**End of Instructions**
