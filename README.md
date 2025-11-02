# Binance Solana Trading Bot

Automated trading bot for Solana (SOL) on Binance that runs hourly analysis and executes trades based on predictive algorithms.

## Features

- 🤖 **Automated Trading**: Runs every hour using cron scheduling
- 📊 **Market Analysis**: Real-time data fetching from Binance API
- 🔮 **Prediction Algorithm**: Multiple technical indicators (RSI, Moving Averages, Momentum, Volume)
- 💼 **Smart Trading Strategy**: Buy/Sell decisions based on algorithm predictions
- 📝 **Comprehensive Logging**: Detailed logs for all operations
- 💰 **Profit & Loss Tracking**: Automatic tracking of all trades with gain/loss calculations
- 🗄️ **MongoDB Integration**: Automatic saving of trades and snapshots to MongoDB for analytics dashboard

## Prerequisites

- Node.js 18+ 
- Binance account with API access
- API Key and Secret from Binance

## Installation

1. Clone the repository
```bash
git clone <your-repo-url>
cd trading-binance
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp env.example .env
# Edit .env with your Binance API credentials
```

4. Create logs directory
```bash
mkdir logs
```

## Configuration

Edit `.env` file with your settings:

```env
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_api_secret_here
TRADE_AMOUNT_USDT=100          # Amount in USDT to use per trade
MIN_CONFIDENCE=50              # Minimum confidence % to execute trade
USE_MARKET_ORDERS=true         # true = market orders, false = limit orders
MONGODB_URI=mongodb://localhost:27017/trading_bot  # MongoDB connection string
MONGODB_DB_NAME=trading_bot   # MongoDB database name
```

## Usage

### Development Mode (with watch)
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

## How It Works

1. **Hourly Execution**: Bot runs every hour at minute 0
2. **Data Collection**: Fetches current SOL/USDT market data and historical candles
3. **Analysis**: Runs prediction algorithm using:
   - RSI (Relative Strength Index)
   - Moving Averages
   - Price Momentum
   - Volume Trends
   - 24h Price Changes
4. **Decision Making**: Generates BUY/SELL/HOLD signal with confidence score
5. **Trade Execution**: Executes trades based on strategy and confidence threshold

## Binance API Setup

1. Go to [Binance API Management](https://www.binance.com/en/my/settings/api-management)
2. Create a new API key
3. **Important**: Enable "Enable Spot & Margin Trading" if you want to execute trades
4. Copy API Key and Secret to `.env` file
5. For safety, restrict IP addresses if possible

## Trading Options

The bot supports multiple Binance order types:

### Market Orders (Immediate Execution)
- **Market Buy**: Buy immediately at current market price
- **Market Sell**: Sell immediately at current market price

### Limit Orders (Price-Specific)
- **Limit Buy**: Buy at a price below current market price
- **Limit Sell**: Sell at a price above current market price

Configure via `USE_MARKET_ORDERS` in `.env`

## Safety Features

- Confidence threshold prevents low-confidence trades
- Balance checks before executing trades
- Comprehensive error handling and logging
- Use 95% of balance to account for fees

## ⚠️ Warning

**This is trading software that uses real money. Use at your own risk!**

- Always test with small amounts first
- Never invest more than you can afford to lose
- Monitor the bot regularly
- Understand the risks of automated trading
- Consider using paper trading mode first (if implemented)

## Profit & Loss Tracking

The bot automatically tracks all your trades and calculates profits/losses:

- **Trade Records**: All buy/sell trades are logged to `logs/trades.json` AND MongoDB
- **Profit Summary**: Summary saved to `logs/profit_summary.json`
- **Real-time Display**: Profit summary shown after each trade and at the end of each cycle
- **MongoDB Integration**: All trades and bot snapshots are automatically saved to MongoDB for analytics

**What gets tracked:**
- Total trades (buys and sells)
- Total invested amount
- Total returned amount
- Closed profit/loss (from matched buy/sell pairs)
- Current holdings value
- Overall profit/loss (including unrealized gains)

**MongoDB Collections:**
- `trades` - All executed trades with full details
- `bot_snapshots` - Hourly snapshots of bot state (market data, balances, predictions)
- `hourly_metrics` - Pre-aggregated hourly metrics for fast queries

> **Note**: If `MONGODB_URI` is not configured, the bot will continue to work normally but won't save to MongoDB. The bot will log a warning and continue without MongoDB.

**Example Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 PROFIT & LOSS SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Trades: 4 (2 buys, 2 sells)
Total Invested: $20.00
Total Returned: $20.50
✅ Closed Profit: +$0.50 (+2.50%)
Current Holdings: 0.0667 SOL | 12.00 USDT
Current Holdings Value: $10.33
✅ Overall Profit: +$0.83 (+4.15%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Project Structure

```
src/
├── index.ts              # Main entry point with cron scheduling
├── bot/
│   └── tradingBot.ts     # Main bot orchestrator
├── services/
│   └── binanceService.ts # Binance API integration
├── algorithms/
│   └── predictionAlgorithm.ts # Trading prediction logic
├── strategies/
│   └── tradingStrategy.ts # Buy/Sell execution logic
└── utils/
    ├── logger.ts          # Logging utility
    └── profitTracker.ts   # Profit & loss tracking
├── services/
    └── mongodbService.ts  # MongoDB integration for analytics
```

## Analytics Dashboard

For a comprehensive analytics dashboard with MongoDB integration, see:
- **Next.js Implementation Guide**: `NEXTJS_IMPLEMENTATION_GUIDE.md`
- The dashboard will connect to the same MongoDB database
- Features: Date range selection, profit/loss charts, trade history, portfolio analytics
```

## License

ISC
