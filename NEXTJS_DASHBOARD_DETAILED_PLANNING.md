# Next.js Trading Bot Analytics Dashboard - Detailed Implementation Plan

## 📋 Project Overview

Create a comprehensive Next.js dashboard that displays all analytics from the trading bot backend. The dashboard will show detailed analytics, decision history, and provide insights into why trades were made or skipped.

---

## 🎯 Project Structure

```
./
├── app/
│   ├── login/
│   │   └── page.tsx
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── components/
│   │       ├── AnalyticsOverview.tsx
│   │       ├── DecisionTimeline.tsx
│   │       ├── ValueComparison.tsx
│   │       ├── SkipReasonsBreakdown.tsx
│   │       ├── PredictionDetails.tsx
│   │       ├── MarketDataDisplay.tsx
│   │       └── ProfitLossChart.tsx
│   └── api/
│       ├── auth/
│       │   └── route.ts
│       ├── analytics/
│       │   ├── route.ts
│       │   ├── decisions/
│       │   │   └── route.ts
│       │   ├── statistics/
│       │   │   └── route.ts
│       │   └── skip-reasons/
│       │       └── route.ts
│       └── [...nextAuth]/route.ts
├── lib/
│   ├── mongodb.ts
│   ├── auth.ts
│   └── queries.ts
├── types/
│   └── analytics.ts
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── ProtectedRoute.tsx
│   ├── ui/
│   │   ├── Card.tsx
│   │   ├── Button.tsx
│   │   ├── Badge.tsx
│   │   ├── Table.tsx
│   │   ├── Pagination.tsx
│   │   └── Select.tsx
│   └── dashboard/
│       ├── DecisionTimeline/
│       │   ├── DecisionTable.tsx
│       │   ├── DecisionRow.tsx
│       │   ├── DecisionDetailsModal.tsx
│       │   └── PaginationControls.tsx
└── package.json
```

---

## 🔐 Authentication

### Login Page (`/login`)

**Credentials:**

- Username: `vashie`
- Password: `35688653`

**Implementation:**

- Simple form-based authentication (not using NextAuth for simplicity)
- Store session in cookies/localStorage
- Redirect to `/dashboard` on successful login
- Show error message on invalid credentials

**File Structure:**

- `app/login/page.tsx` - Login form component

---

## 📊 Dashboard Features

### 1. Analytics Overview Page (`/dashboard`)

Display comprehensive analytics with multiple sections:

#### A. Summary Cards (Top Row)

- **Total Decisions**: Count of all decisions (TRADED + SKIPPED)
- **Traded Count**: Number of executed trades
- **Skipped Count**: Number of skipped trades
- **Traded Percentage**: (Traded / Total) × 100
- **Skipped Percentage**: (Skipped / Total) × 100
- **Current Portfolio Value**: Latest total portfolio value
- **Total Gain/Loss**: Overall profit/loss from start

#### B. Value Comparison Section

Display previous vs current values with changes:

**Data Source:** `hour_decisions` collection, `analytics` field

**Display Fields:**

```
Previous Values:
- SOL Balance: analytics.previousBalances.sol
- USDT Balance: analytics.previousBalances.usdt
- Total Value: analytics.previousBalances.totalValue
- Price: analytics.previousPrice
- Timestamp: analytics.previousTimestamp

Current Values:
- SOL Balance: balances.sol
- USDT Balance: balances.usdt
- Total Value: balances.totalValue
- Price: marketData.price
- Timestamp: timestamp

Changes (Calculate from analytics.valueChange):
- SOL Change: analytics.valueChange.sol.amount (+/- analytics.valueChange.sol.percent%)
- USDT Change: analytics.valueChange.usdt.amount (+/- analytics.valueChange.usdt.percent%)
- Total Change: analytics.valueChange.total.amount (+/- analytics.valueChange.total.percent%)
- Price Change: analytics.priceChange.amount (+/- analytics.priceChange.percent%)
```

**Visual Design:**

- Side-by-side comparison layout
- Color coding: Green for gains, Red for losses
- Percentage badges with arrows (↑ for increase, ↓ for decrease)

#### C. Decision Timeline (Hourly Tracking with Pagination)

Show all decisions chronologically with full pagination support:

**Data Source:** `hour_decisions` collection

**Display for Each Decision (Table Row):**

```
- Timestamp: timestamp (formatted as "YYYY-MM-DD HH:00")
- Hour: Extract hour from timestamp (e.g., "10:00", "14:00")
- Decision Type: decision ("TRADED" or "SKIPPED")
- Signal: prediction.signal ("BUY", "SELL", or "HOLD")
- Confidence: prediction.confidence (%)
- Price: marketData.price
- Portfolio Value: balances.totalValue
- Portfolio Change: analytics.valueChange?.total (amount and %)
- Status Badge: Color-coded (Green for TRADED, Yellow for SKIPPED)
- Actions: Expand button to view full details
```

**Pagination Features:**

- **Default items per page**: 25 decisions per page
- **Pagination controls**: Previous, Next, Page numbers
- **Items per page selector**: Options: 10, 25, 50, 100
- **Total count display**: "Showing 1-25 of 156 decisions"
- **Page navigation**: Jump to specific page
- **URL state management**: Query params like `?page=2&limit=25`

**Pagination Implementation:**

```
API Query Parameters:
- page: number (default: 1)
- limit: number (default: 25, max: 100)
- offset: number (calculated as (page - 1) * limit)

API Response:
{
  decisions: HourDecision[],
  pagination: {
    currentPage: number,
    totalPages: number,
    totalItems: number,
    itemsPerPage: number,
    hasNextPage: boolean,
    hasPreviousPage: boolean
  }
}
```

**Features:**

- Sortable table columns (timestamp, confidence, price, portfolio value)
- Filter by decision type (TRADED/SKIPPED) - preserves pagination
- Filter by date range - preserves pagination
- Search by hour/date
- Click row to expand full details in modal/drawer
- Export visible page to CSV
- Export all (with confirmation for large datasets)
- "Load More" button option (infinite scroll alternative)

#### D. Detailed Skip Analysis

For SKIPPED decisions, show comprehensive analysis:

**Data Source:** `hour_decisions` collection where `decision === "SKIPPED"`

**Display Fields:**

```
Main Skip Analysis (analytics.detailedSkipAnalysis):
- Full formatted text explanation

Skip Reasons Breakdown:
- For each in skipReasons[]:
  - Reason: skipReasons[].reason
  - Details: skipReasons[].details (formatted)
  - Timestamp: skipReasons[].timestamp

Decision Explanation:
- analytics.decisionExplanation
```

**Common Skip Reason Types:**

1. **LOW_CONFIDENCE**

   - Details: `confidence`, `minConfidence`, `threshold`
   - Display: "Confidence {confidence}% is below minimum {minConfidence}% threshold"

2. **HOLD_SIGNAL**

   - Details: `signal`, `explanation`
   - Display: "{explanation}"

3. **INSUFFICIENT_BALANCE_BUY**

   - Details: `availableBalance`, `requiredAmount`, `minTradeAmount`
   - Display: "Only ${availableBalance} USDT available, need ${minTradeAmount} minimum"

4. **INSUFFICIENT_BALANCE_SELL**

   - Details: `availableBalance`, `requiredQuantity`, `minTradeAmount`
   - Display: "Only {availableBalance} SOL available, need {minTradeAmount} minimum"

5. **EXECUTION_ERROR**
   - Details: `errorMessage`, `errorCode`
   - Display: Error message and code

**Special Note Display:**

- If `analytics.valueChange.total.amount > 0` AND `analytics.priceChange.amount > 0`
- Show: "💡 Note: Portfolio value increased, but trade was skipped because..."
- List reasons from skipReasons

#### E. Prediction Details Section

Show technical analysis details:

**Data Source:** `hour_decisions[].prediction`

**Display Fields:**

```
Prediction Signal: prediction.signal
Confidence: prediction.confidence (%)
Predicted Price: prediction.predictedPrice

Technical Indicators:
- RSI: prediction.indicators.rsi (if available)
  - Show on scale: 0-30 (oversold), 30-70 (neutral), 70-100 (overbought)
  - Visual indicator bar with color zones

- Moving Average: prediction.indicators.movingAverage (if available)
- Price Momentum: prediction.indicators.priceMomentum (if available)
  - Show as percentage with arrow (↑ positive, ↓ negative)

- Volume Trend: prediction.indicators.volumeTrend (if available)
  - Badge: "increasing" (green), "decreasing" (red), "stable" (gray)

Reasoning:
- Display each item in prediction.reasoning[] as a bullet point
```

**Visual Design:**

- Card layout with sections for each indicator
- RSI gauge chart (0-100 with zones)
- Momentum indicator with color and arrow
- Reasoning as expandable list

#### F. Market Data Display

Show current and historical market data:

**Data Source:** `hour_decisions[].marketData`

**Display Fields:**

```
Current Market Data:
- Symbol: marketData.symbol
- Price: marketData.price
- 24h Volume: marketData.volume24h
- 24h Price Change: marketData.priceChange24h
- 24h Price Change %: marketData.priceChangePercent24h
- 24h High: marketData.high24h
- 24h Low: marketData.low24h
- Timestamp: marketData.timestamp
```

**Visual Design:**

- Price display with large, prominent number
- 24h change with color coding
- High/Low indicators
- Chart showing price over time (if multiple timestamps available)

#### G. Trade Details (for TRADED decisions)

Show detailed trade information:

**Data Source:** `hour_decisions[].tradeDetails` (only when `decision === "TRADED"`)

**Display Fields:**

```
Trade Type: tradeDetails.type ("BUY" or "SELL")
Signal: tradeDetails.signal
Confidence: tradeDetails.confidence (%)
Quantity: tradeDetails.quantity
Price: tradeDetails.price
Amount: tradeDetails.amount
Trading Pair: tradeDetails.tradingPair
Order ID: tradeDetails.orderId

Balance Before:
- SOL: tradeDetails.balanceBefore.sol
- USDT: tradeDetails.balanceBefore.usdt
- Total: tradeDetails.balanceBefore.totalValue

Balance After:
- SOL: tradeDetails.balanceAfter.sol
- USDT: tradeDetails.balanceAfter.usdt
- Total: tradeDetails.balanceAfter.totalValue

Profit/Loss (if available):
- profit: tradeDetails.profit
```

**Visual Design:**

- Card with clear "BUY" (green) or "SELL" (red) header
- Before/After comparison
- Profit/Loss highlighted prominently

#### H. Charts and Visualizations

1. **Profit/Loss Over Time**

   - Line chart showing portfolio value changes
   - X-axis: Timestamp
   - Y-axis: Total Value
   - Markers for TRADED (green dots) and SKIPPED (yellow dots)

2. **Decision Distribution**

   - Pie chart: TRADED vs SKIPPED percentages
   - Bar chart: Count per day

3. **Confidence Levels Over Time**

   - Line chart: Prediction confidence % over time
   - Threshold line at 50% (or configurable MIN_CONFIDENCE)

4. **Skip Reasons Breakdown**

   - Bar chart: Count of each skip reason type
   - Colors for different reason categories

5. **Price and Portfolio Value Correlation**
   - Dual-axis chart:
     - Line 1: SOL Price
     - Line 2: Portfolio Total Value

---

## 🗄️ Database Schema Reference

### Collection: `hour_decisions`

**Complete Field Mapping:**

```typescript
{
  // Basic Fields
  timestamp: Date,
  decision: "TRADED" | "SKIPPED",
  executionTime?: number, // milliseconds

  // Skip Reasons
  skipReasons?: Array<{
    reason: string,
    details: any, // Object with specific fields per reason type
    timestamp: Date
  }>,

  // Trade Details (only when decision === "TRADED")
  tradeDetails?: {
    signal: string,
    type: "BUY" | "SELL",
    confidence: number,
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
    tradingPair: string,
    orderId?: string,
    profit?: number
  },

  // Prediction Data
  prediction: {
    signal: "BUY" | "SELL" | "HOLD",
    confidence: number, // 0-100
    predictedPrice: number,
    reasoning: string[],
    indicators: {
      rsi?: number,
      movingAverage?: number,
      priceMomentum?: number,
      volumeTrend?: "increasing" | "decreasing" | "stable"
    }
  },

  // Market Data
  marketData: {
    symbol: string,
    price: number,
    volume24h: number,
    priceChange24h: number,
    priceChangePercent24h: number,
    high24h: number,
    low24h: number,
    timestamp: number,
    klineData?: any[]
  },

  // Current Balances
  balances: {
    sol: number,
    usdt: number,
    totalValue: number
  },

  // Error Details (only when error occurred)
  errorDetails?: {
    message: string,
    stack?: string,
    timestamp: Date
  },

  // Analytics (NEW - Detailed analytics)
  analytics?: {
    // Previous Values
    previousBalances?: {
      sol: number,
      usdt: number,
      totalValue: number
    },
    previousPrice?: number,
    previousTimestamp?: Date,

    // Value Changes
    valueChange?: {
      sol: {
        amount: number,
        percent: number
      },
      usdt: {
        amount: number,
        percent: number
      },
      total: {
        amount: number,
        percent: number
      }
    },

    // Price Change
    priceChange?: {
      amount: number,
      percent: number
    },

    // Detailed Analysis
    detailedSkipAnalysis?: string, // Full formatted text
    decisionExplanation?: string // Summary explanation
  },

  // MongoDB metadata
  createdAt: Date,
  updatedAt: Date
}
```

### Other Collections Used:

1. **`trades`** - Individual trade records
2. **`bot_snapshots`** - Hourly snapshots of bot state
3. **`startup_balances`** - Initial balance tracking

---

## 🔌 API Routes

### 1. Authentication API (`/api/auth`)

**POST `/api/auth/login`**

- Body: `{ username: string, password: string }`
- Response: `{ success: boolean, token?: string, error?: string }`

**POST `/api/auth/logout`**

- Clear session

### 2. Analytics API (`/api/analytics`)

**GET `/api/analytics/decisions`**

- Query params:
  - `startDate?: string` (ISO date)
  - `endDate?: string` (ISO date)
  - `decision?: "TRADED" | "SKIPPED"`
  - `page?: number` (default: 1)
  - `limit?: number` (default: 25, max: 100)
  - `offset?: number` (optional, calculated if page provided)
  - `sortBy?: "timestamp" | "confidence" | "price" | "totalValue"` (default: "timestamp")
  - `sortOrder?: "asc" | "desc"` (default: "desc")
- Response:

```typescript
{
  decisions: HourDecision[],
  pagination: {
    currentPage: number,
    totalPages: number,
    totalItems: number,
    itemsPerPage: number,
    hasNextPage: boolean,
    hasPreviousPage: boolean
  }
}
```

**GET `/api/analytics/statistics`**

- Query params:
  - `startDate?: string`
  - `endDate?: string`
- Response: `{ total: number, traded: number, skipped: number, tradedPercent: number, skippedPercent: number }`

**GET `/api/analytics/skip-reasons`**

- Query params:
  - `startDate?: string`
  - `endDate?: string`
- Response: `Array<{ reason: string, count: number, latest: Date }>`

**GET `/api/analytics/latest`**

- Response: Latest hour decision with full analytics

---

## 📦 Required Packages

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "mongodb": "^6.0.0",
    "recharts": "^2.8.0", // For charts
    "date-fns": "^2.30.0", // Date formatting
    "bcryptjs": "^2.4.3", // Password hashing
    "cookie": "^0.5.0", // Cookie management
    "tailwindcss": "^3.3.0", // Styling
    "typescript": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/bcryptjs": "^2.4.6",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

---

## 🎨 UI/UX Guidelines

### Color Scheme:

- **TRADED**: Green (#10B981)
- **SKIPPED**: Yellow (#F59E0B)
- **BUY**: Green (#10B981)
- **SELL**: Red (#EF4444)
- **HOLD**: Gray (#6B7280)
- **Gains**: Green
- **Losses**: Red

### Typography:

- Headers: Bold, larger sizes
- Data values: Monospace font for numbers
- Descriptions: Regular weight

### Layout:

- Responsive grid system
- Cards for each section
- Spacing between sections
- Mobile-friendly design

### Icons:

- Use consistent icon library (Lucide React or Heroicons)
- 📈 for increases
- 📉 for decreases
- ✅ for success
- ⚠️ for warnings
- ❌ for errors

---

## 📝 Implementation Checklist

### Phase 1: Setup

- [ ] Initialize Next.js project
- [ ] Set up MongoDB connection
- [ ] Configure environment variables
- [ ] Install required packages
- [ ] Set up Tailwind CSS

### Phase 2: Authentication

- [ ] Create login page
- [ ] Implement authentication logic
- [ ] Set up session management
- [ ] Create protected route wrapper

### Phase 3: API Routes

- [ ] Create authentication API
- [ ] Create analytics decisions API
- [ ] Create statistics API
- [ ] Create skip reasons API
- [ ] Create latest decision API

### Phase 4: Dashboard Components

- [ ] Summary cards component
- [ ] Value comparison component
- [ ] Decision timeline component
  - [ ] Table with sortable columns
  - [ ] Pagination component
  - [ ] Page navigation controls
  - [ ] Items per page selector
  - [ ] Expandable row details
  - [ ] Filter integration with pagination
- [ ] Skip analysis component
- [ ] Prediction details component
- [ ] Market data component
- [ ] Trade details component

### Phase 5: Charts

- [ ] Profit/Loss chart
- [ ] Decision distribution charts
- [ ] Confidence levels chart
- [ ] Skip reasons chart
- [ ] Price correlation chart

### Phase 6: Integration

- [ ] Connect all components
- [ ] Implement data fetching
- [ ] Add loading states
- [ ] Add error handling
- [ ] Implement filtering and pagination
  - [ ] Pagination state management
  - [ ] URL query param synchronization
  - [ ] Server-side pagination logic
  - [ ] Pagination UI components
  - [ ] Filter + pagination integration
  - [ ] Sort + pagination integration

### Phase 7: Polish

- [ ] Responsive design testing
- [ ] Performance optimization
- [ ] Accessibility improvements
- [ ] Error boundaries
- [ ] Loading skeletons

---

## 🔒 Security Considerations

1. **Password Storage**: Hash password before comparison (use bcrypt)
2. **Session Management**: Use secure cookies or JWT tokens
3. **API Protection**: Protect all API routes except login
4. **Input Validation**: Validate all inputs on API routes
5. **MongoDB**: Use connection pooling and proper error handling

---

## 🌐 Environment Variables

```env
MONGODB_URI=mongodb://localhost:27017/trading_bot
MONGODB_DB_NAME=trading_bot
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
ADMIN_USERNAME=vashie
ADMIN_PASSWORD_HASH=<bcrypt-hashed-password>
```

---

## 📚 Key Files to Create

### Backend API Files:

1. `app/api/auth/route.ts` - Authentication endpoints
2. `app/api/analytics/decisions/route.ts` - Get decisions
3. `app/api/analytics/statistics/route.ts` - Get statistics
4. `app/api/analytics/skip-reasons/route.ts` - Get skip reasons
5. `app/api/analytics/latest/route.ts` - Get latest decision

### Frontend Pages:

1. `app/login/page.tsx` - Login page
2. `app/dashboard/page.tsx` - Main dashboard

### Utility Files:

1. `lib/mongodb.ts` - MongoDB connection
2. `lib/queries.ts` - Database query functions
3. `lib/auth.ts` - Authentication utilities
4. `types/analytics.ts` - TypeScript types matching backend

### Components:

1. All component files listed in project structure

---

## 📊 Data Flow

```
User → Login Page → Authenticate → Dashboard
                                       ↓
                              Fetch API Routes (with pagination params)
                                       ↓
                              MongoDB Queries (with skip/limit)
                                       ↓
                              Return Paginated Data + Metadata
                                       ↓
                              Display in Components with Pagination
                                       ↓
                              User changes page → Update URL params → Refetch
```

## 🔄 Pagination Flow

```
1. User opens Dashboard
   → Default: page=1, limit=25

2. User clicks "Next Page" or page number
   → Update URL: ?page=2&limit=25
   → Fetch new data with offset=(page-1)*limit

3. User changes "Items per page"
   → Update URL: ?page=1&limit=50
   → Reset to page 1, fetch with new limit

4. User applies filter
   → Keep pagination params
   → Reset to page 1
   → Fetch filtered + paginated data

5. User sorts column
   → Keep pagination params
   → Add sort params
   → Fetch sorted + paginated data
```

---

## 🎯 Success Criteria

1. ✅ All analytics fields from backend are displayed
2. ✅ Previous vs current values are shown with calculations
3. ✅ Skip reasons are detailed and explained
4. ✅ Charts visualize trends over time
5. ✅ Responsive and mobile-friendly
6. ✅ Fast loading and smooth interactions
7. ✅ Secure authentication
8. ✅ Field names match backend exactly

---

## 📖 Additional Notes

- Use TypeScript for type safety
- Match field names EXACTLY as defined in backend interfaces
- Handle null/undefined values gracefully
- Format dates consistently (use date-fns)
- Format currency consistently (USD format)
- Format percentages with 2 decimal places
- Show loading states during API calls
- Implement error boundaries
- Add tooltips for technical terms
- Include help text for complex indicators

## 📄 Pagination Implementation Details

### Pagination Component Specifications

**UI Elements:**

- Previous button (disabled on first page)
- Page number buttons (show current page ± 2 pages, ellipsis for gaps)
- Next button (disabled on last page)
- Page jump input (optional: "Go to page X")
- Items per page dropdown: [10, 25, 50, 100]
- Display text: "Showing X-Y of Z decisions"

**Example Pagination UI:**

```
[< Prev] [1] [2] [3] ... [10] [11] [12] [Next >]
Items per page: [25 ▼] | Showing 1-25 of 156 decisions
```

**State Management:**

- Use React state for current page
- Sync with URL query params (`?page=2&limit=25`)
- Update URL when pagination changes
- Read URL params on component mount
- Persist pagination across filter changes (reset to page 1)

**Performance Considerations:**

- Implement loading skeletons during pagination
- Cache previous pages (optional optimization)
- Debounce rapid page changes
- Show pagination controls while loading

**Mobile Responsive:**

- Show fewer page numbers on mobile
- Simplify controls: [<] [1/10] [>]
- Touch-friendly button sizes

**Database Query Optimization:**

```typescript
// MongoDB query with pagination
const skip = (page - 1) * limit;
const decisions = await collection
  .find(filter)
  .sort({ timestamp: -1 })
  .skip(skip)
  .limit(limit)
  .toArray();

const total = await collection.countDocuments(filter);
const totalPages = Math.ceil(total / limit);
```

**Hourly Tracking Display:**

- Group by date (optional feature)
- Show date headers: "November 3, 2024" → list hours
- Filter by specific date
- Quick date navigation: "Today", "Yesterday", "Last 7 days", "Last 30 days"
- Timeline view option: Visual timeline with all hours marked

---

## 🔄 Next Steps After Implementation

1. Test with real data from MongoDB
2. Add export functionality (CSV, PDF)
3. Add email notifications
4. Implement real-time updates (WebSockets)
5. Add more advanced filtering
6. Create custom date range selector
7. Add comparison features (compare different time periods)
8. Implement search functionality

---

This document provides a complete roadmap for building the analytics dashboard. Ensure all field names match exactly with the backend MongoDB schema to avoid data mapping issues.
