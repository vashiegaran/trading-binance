# Binance Solana Trading Bot - Complete Planning Document

## Project Overview

A Node.js automated trading bot that monitors Solana (SOL) price on Binance and executes buy/sell orders based on predictive algorithms. The bot runs hourly using cron jobs.

---

## 1. Binance API Overview

### API Endpoints Used

#### Public Endpoints (No Authentication Required)
- **Price Ticker**: Get current price for SOL/USDT
- **24hr Ticker Statistics**: Price change, volume, high/low
- **Kline/Candlestick Data**: Historical price data (hourly candles)
- **Exchange Information**: Trading rules, min/max amounts

#### Authenticated Endpoints (Requires API Key)
- **Account Information**: Get balances for USDT and SOL
- **Place Order**: Buy or sell SOL
- **Order Status**: Check order execution
- **Trade History**: View past trades

### Binance API Documentation
- Official Docs: https://binance-docs.github.io/apidocs/spot/en/
- API Library: `binance-api-node` npm package

---

## 2. Binance Trading Options Explained

### Order Types

#### 1. **Market Orders** (Immediate Execution)
- **Market Buy**: Buy SOL immediately at current market price
  - Pros: Instant execution, guaranteed fill
  - Cons: Price slippage possible, no price control
  
- **Market Sell**: Sell SOL immediately at current market price
  - Pros: Instant execution, guaranteed fill
  - Cons: Price slippage possible, no price control

#### 2. **Limit Orders** (Price-Specific)
- **Limit Buy**: Set a price to buy SOL when price drops to that level
  - Pros: Price control, can get better entry
  - Cons: May not execute if price doesn't reach limit
  
- **Limit Sell**: Set a price to sell SOL when price rises to that level
  - Pros: Price control, can get better exit
  - Cons: May not execute if price doesn't reach limit

#### 3. **Stop-Loss Orders** (Risk Management)
- **Stop-Loss**: Automatically sell if price drops below threshold
- **Stop-Limit**: Sell at limit price after stop price is triggered

#### 4. **Advanced Orders**
- **OCO (One-Cancels-Other)**: Two orders, one cancels the other when executed
- **Iceberg Orders**: Large orders split into smaller chunks

### Recommendation for This Bot

**For Automated Hourly Trading:**
1. **Primary Choice**: Market Orders
   - Best for: Automated execution, time-sensitive decisions
   - Use when: Algorithm gives high-confidence signal

2. **Secondary Choice**: Limit Orders
   - Best for: Better price execution, patient trading
   - Use when: Setting orders slightly below/above market price

**Implementation Strategy:**
- Use environment variable `USE_MARKET_ORDERS` to switch between:
  - `true`: Market orders (immediate execution)
  - `false`: Limit orders (price-optimized, may not execute)

---

## 3. Step-by-Step Trading Process

### Complete Flow Diagram

```
Hourly Cron Trigger (Every hour at :00)
    ↓
1. Fetch Market Data
   ├── Current SOL/USDT price
   ├── 24h statistics (volume, change %)
   └── Historical kline data (100 hours)
    ↓
2. Run Prediction Algorithm
   ├── Calculate RSI (Relative Strength Index)
   ├── Calculate Moving Averages
   ├── Analyze Price Momentum
   ├── Analyze Volume Trends
   └── Generate BUY/SELL/HOLD signal
    ↓
3. Check Trading Conditions
   ├── Signal confidence ≥ MIN_CONFIDENCE?
   ├── Signal is BUY or SELL (not HOLD)?
   └── Sufficient balance available?
    ↓
4. Execute Trade Strategy
   ├── BUY Signal:
   │   ├── Check USDT balance
   │   ├── Calculate quantity (TRADE_AMOUNT_USDT / price)
   │   └── Place buy order (market or limit)
   │
   └── SELL Signal:
       ├── Check SOL balance
       ├── Calculate quantity (available SOL)
       └── Place sell order (market or limit)
    ↓
5. Log Results
   └── Save trade execution details
```

### Detailed Steps

#### Step 1: Fetch Market Data
```typescript
// Get current price
GET /api/v3/ticker/price?symbol=SOLUSDT

// Get 24hr statistics
GET /api/v3/ticker/24hr?symbol=SOLUSDT

// Get historical candles (hourly)
GET /api/v3/klines?symbol=SOLUSDT&interval=1h&limit=100
```

**Data Collected:**
- Current price: `$X.XX`
- 24h change: `+X.XX%`
- 24h volume: `XXXXX USDT`
- High/Low: `$X.XX / $X.XX`
- Historical candles: `[close, open, high, low, volume]`

#### Step 2: Run Prediction Algorithm

**Technical Indicators Calculated:**

1. **RSI (Relative Strength Index)**
   - Formula: `RSI = 100 - (100 / (1 + RS))`
   - Where: `RS = Average Gain / Average Loss`
   - Signals:
     - RSI < 30: Oversold → BUY signal
     - RSI > 70: Overbought → SELL signal
     - 30-70: Neutral

2. **Simple Moving Average (SMA)**
   - Calculate 50-period SMA from historical data
   - Compare current price to SMA:
     - Price < SMA: Potential buy opportunity
     - Price > SMA: Potential sell opportunity

3. **Price Momentum**
   - Calculate % change over last 10 periods
   - Positive momentum: Potential upward trend
   - Negative momentum: Potential downward trend

4. **Volume Trend**
   - Analyze volume over last 5 periods
   - Increasing volume: Stronger trend confirmation
   - Decreasing volume: Weakening trend

5. **24h Price Change**
   - Large gains (>5%): Consider profit-taking
   - Large losses (>5%): Consider buying opportunity

**Scoring System:**
- Each indicator contributes points to BUY or SELL score
- Total confidence = |BUY_score - SELL_score|
- Signal determined by higher score

#### Step 3: Check Trading Conditions

**Validation Rules:**
1. Confidence must be ≥ `MIN_CONFIDENCE` (default: 50%)
2. Signal must be BUY or SELL (not HOLD)
3. For BUY: Must have sufficient USDT balance
4. For SELL: Must have sufficient SOL balance
5. Trade amount must meet Binance minimum requirements

#### Step 4: Execute Trade

**BUY Execution:**
```typescript
// Calculate quantity
const tradeAmountUSDT = Math.min(TRADE_AMOUNT_USDT, usdtBalance * 0.95);
const quantity = tradeAmountUSDT / currentPrice;

// Market Buy
POST /api/v3/order
{
  symbol: "SOLUSDT",
  side: "BUY",
  type: "MARKET",
  quantity: "X.XXXX"
}

// OR Limit Buy
POST /api/v3/order
{
  symbol: "SOLUSDT",
  side: "BUY",
  type: "LIMIT",
  quantity: "X.XXXX",
  price: "X.XX",
  timeInForce: "GTC"
}
```

**SELL Execution:**
```typescript
// Calculate quantity (use 95% of balance for fees)
const quantity = Math.min(solBalance * 0.95, solBalance);

// Market Sell
POST /api/v3/order
{
  symbol: "SOLUSDT",
  side: "SELL",
  type: "MARKET",
  quantity: "X.XXXX"
}

// OR Limit Sell
POST /api/v3/order
{
  symbol: "SOLUSDT",
  side: "SELL",
  type: "LIMIT",
  quantity: "X.XXXX",
  price: "X.XX",
  timeInForce: "GTC"
}
```

---

## 4. Monitoring Algorithm (Hourly)

### Current Implementation

**Cron Schedule:** `0 * * * *` (Every hour at minute 0)

**Process:**
1. Bot wakes up every hour
2. Fetches latest market data
3. Runs prediction algorithm
4. Executes trades if conditions met
5. Logs all actions
6. Waits until next hour

### Algorithm Logic Flow

```
START
  ↓
Fetch Latest Data (1 API call)
  ↓
Calculate Indicators:
  - RSI from last 14 hours
  - SMA from last 50 hours
  - Momentum from last 10 hours
  - Volume trend analysis
  ↓
Score Indicators:
  - Assign points to BUY or SELL
  - Calculate total confidence
  ↓
Decision:
  - If confidence < threshold → HOLD
  - If BUY score > SELL score → BUY
  - If SELL score > BUY score → SELL
  ↓
Execute Trade:
  - Check balances
  - Calculate quantities
  - Place order via Binance API
  ↓
Log Results
  ↓
WAIT until next hour
  ↓
Repeat
```

### Prediction Algorithm Details

**Buy Signal Conditions (Any combination):**
- RSI < 30 (oversold)
- Price below 50-period SMA
- Positive momentum > 2%
- Increasing volume trend
- 24h decline > 5%

**Sell Signal Conditions (Any combination):**
- RSI > 70 (overbought)
- Price above 50-period SMA
- Negative momentum < -2%
- Decreasing volume trend
- 24h gain > 5%

**Hold Signal:**
- Mixed indicators
- Low confidence (< 50%)
- Insufficient data

---

## 5. Implementation Plan

### Phase 1: Basic Setup ✅
- [x] Node.js project structure
- [x] TypeScript configuration
- [x] Cron job setup
- [x] Basic project structure

### Phase 2: Binance Integration
- [ ] Binance API client setup
- [ ] Market data fetching
- [ ] Account balance retrieval
- [ ] Order placement functions

### Phase 3: Prediction Algorithm
- [ ] RSI calculation
- [ ] Moving average calculation
- [ ] Momentum analysis
- [ ] Volume trend analysis
- [ ] Signal generation logic

### Phase 4: Trading Strategy
- [ ] Buy strategy implementation
- [ ] Sell strategy implementation
- [ ] Balance validation
- [ ] Order execution logic

### Phase 5: Testing & Safety
- [ ] Paper trading mode
- [ ] Error handling
- [ ] Logging system
- [ ] Safety checks

### Phase 6: Monitoring & Optimization
- [ ] Performance monitoring
- [ ] Algorithm tuning
- [ ] Risk management
- [ ] Alert system

---

## 6. Binance API Best Practices

### Security
1. **Never commit API keys to git**
2. **Use environment variables** for credentials
3. **Enable IP whitelist** on Binance API settings
4. **Use read-only keys** for testing when possible
5. **Rotate API keys** periodically

### Rate Limits
- **Weight System**: Each endpoint has a weight
- **1200 weight per minute** for authenticated requests
- **Implementation**: Add request queuing/throttling if needed

### Error Handling
- **HTTP 429**: Rate limit exceeded → Wait and retry
- **HTTP 400**: Bad request → Check parameters
- **HTTP 401**: Authentication failed → Check API keys
- **Network errors**: Implement retry logic

### Testing
- **Testnet**: Use Binance testnet for testing
- **Small amounts**: Start with minimal trades
- **Paper trading**: Simulate trades without real money

---

## 7. Trading Strategy Recommendations

### Conservative Strategy
- **MIN_CONFIDENCE**: 70%+
- **TRADE_AMOUNT_USDT**: Small (e.g., $50)
- **USE_MARKET_ORDERS**: false (limit orders)
- **Risk**: Lower returns, safer

### Aggressive Strategy
- **MIN_CONFIDENCE**: 40%+
- **TRADE_AMOUNT_USDT**: Larger (e.g., $500)
- **USE_MARKET_ORDERS**: true (immediate execution)
- **Risk**: Higher returns, more volatile

### Balanced Strategy (Recommended)
- **MIN_CONFIDENCE**: 50%
- **TRADE_AMOUNT_USDT**: Moderate (e.g., $100-200)
- **USE_MARKET_ORDERS**: true (for time-sensitive decisions)
- **Risk**: Balanced approach

---

## 8. Additional Considerations

### Risk Management
1. **Stop-Loss Orders**: Implement automatic stop-loss
2. **Position Sizing**: Never trade more than X% of portfolio
3. **Maximum Drawdown**: Stop trading if losses exceed threshold
4. **Daily Limits**: Set maximum trades per day

### Monitoring & Alerts
1. **Email/SMS alerts** for trades executed
2. **Telegram bot** for notifications
3. **Dashboard** for monitoring (future enhancement)
4. **Performance metrics**: Track win rate, profit/loss

### Future Enhancements
1. **Multi-timeframe analysis**: Combine hourly with daily trends
2. **Machine Learning**: Train ML model on historical data
3. **Backtesting**: Test strategies on historical data
4. **Portfolio management**: Multiple trading pairs
5. **Web dashboard**: React frontend for monitoring

---

## 9. Next Steps

1. ✅ **Project Setup**: Complete
2. 🔄 **Binance API Integration**: Implement service layer
3. 🔄 **Algorithm Implementation**: Build prediction logic
4. 🔄 **Strategy Implementation**: Build trading execution
5. ⏳ **Testing**: Test with small amounts
6. ⏳ **Deployment**: Run on server/VPS
7. ⏳ **Monitoring**: Set up alerts and logging

---

## 10. Resources

### Binance Documentation
- API Docs: https://binance-docs.github.io/apidocs/spot/en/
- Testnet: https://testnet.binance.vision/
- API Key Management: https://www.binance.com/en/my/settings/api-management

### Technical Indicators
- RSI Explanation: https://www.investopedia.com/terms/r/rsi.asp
- Moving Averages: https://www.investopedia.com/terms/m/movingaverage.asp

### npm Packages
- `binance-api-node`: Official Binance API wrapper
- `node-cron`: Cron job scheduling
- `winston`: Logging

---

## ⚠️ Important Warnings

1. **This bot uses real money** - Always test thoroughly
2. **Cryptocurrency trading is risky** - Only invest what you can lose
3. **No guarantee of profits** - Past performance ≠ future results
4. **Monitor regularly** - Don't leave it completely unattended
5. **Start small** - Test with minimal amounts first
6. **Understand the code** - Don't run code you don't understand

---

## Summary

This planning document outlines:
- ✅ How Binance API works
- ✅ All trading options available (Market, Limit, etc.)
- ✅ Complete step-by-step trading process
- ✅ Hourly monitoring algorithm
- ✅ Prediction algorithm details
- ✅ Implementation plan
- ✅ Best practices and recommendations

The bot is structured to be:
- **Modular**: Easy to modify and extend
- **Safe**: Multiple validation checks
- **Transparent**: Comprehensive logging
- **Flexible**: Configurable via environment variables

Ready to implement! 🚀

