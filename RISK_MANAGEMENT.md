# Risk Management Features

## Overview

The bot now includes comprehensive risk management features to protect your capital and limit losses.

## Implemented Features

### 0. **Emergency Stop-Loss Protection** 🚨 (HIGHEST PRIORITY)

- **What it does**: Automatically sells ALL SOL holdings if total portfolio is down by a configured percentage from startup balance
- **Default**: 15% loss triggers emergency sell
- **Configuration**: `EMERGENCY_STOP_LOSS_PERCENT=15` in `.env`
- **How it works**:
  - Compares current total portfolio value vs startup balance (from MongoDB)
  - **Works even when there are 0 trades** - uses startup balance as reference
  - If portfolio down ≥ 15%, **immediately sells ALL SOL** regardless of prediction
  - Overrides confidence to 100% for emergency execution
  - **This is the highest priority check** - runs before all other risk management

**Example:**

```
Startup Portfolio: $22.23
Current Portfolio: $19.69 (down 11.43%)
→ No action yet (below 15% threshold)

If drops to $18.90 (down 15%):
→ Emergency stop-loss triggered → SELL ALL SOL immediately
```

### 1. **Automatic Stop-Loss Protection** 🛑

- **What it does**: Automatically sells your SOL position if it's down by a configured percentage from your average entry price
- **Default**: 5% loss triggers stop-loss
- **Configuration**: `STOP_LOSS_PERCENT=5` in `.env`
- **How it works**:
  - Calculates average entry price from all unmatched BUY trades (FIFO matching)
  - Checks current price vs entry price every hour
  - If loss ≥ stop-loss %, **immediately sells** regardless of prediction signal
  - Overrides confidence to 100% for stop-loss execution

**Example:**

```
Entry Price: $150.00
Current Price: $142.50 (down 5%)
→ Stop-loss triggered → SELL executed immediately
```

### 2. **Maximum Drawdown Protection** 🚨

- **What it does**: Pauses all trading if your total portfolio value drops by a configured percentage from startup
- **Default**: 10% drawdown pauses trading
- **Configuration**: `MAX_DRAWDOWN_PERCENT=10` in `.env`
- **How it works**:
  - Compares current portfolio value vs startup balance (from MongoDB)
  - If drawdown ≥ maximum %, **pauses all trading** until you manually intervene
  - Prevents further losses during bad market conditions

**Example:**

```
Startup Portfolio: $100.00
Current Portfolio: $89.00 (down 11%)
→ Maximum drawdown exceeded → Trading paused
```

### 3. **Automatic Take-Profit** 💰

- **What it does**: Automatically sells your SOL position if it's up by a configured percentage from your average entry price
- **Default**: 15% profit triggers take-profit
- **Configuration**: `TAKE_PROFIT_PERCENT=15` in `.env`
- **How it works**:
  - Calculates average entry price from unmatched BUY trades
  - Checks current price vs entry price every hour
  - If profit ≥ take-profit %, **automatically sells** to lock in profits
  - Overrides confidence to 100% for take-profit execution

**Example:**

```
Entry Price: $150.00
Current Price: $172.50 (up 15%)
→ Take-profit triggered → SELL executed to lock profits
```

### 4. **Position Size Limit** 📊

- **What it does**: Prevents buying more SOL if you already have $10 worth (or configured limit)
- **Default**: $10 maximum position value
- **Configuration**: `MAX_POSITION_VALUE_USDT=10` in `.env`
- **How it works**:
  - Checks current SOL position value before every BUY
  - If position value ≥ limit, **skips buy** regardless of prediction
  - Ensures you don't over-invest beyond your intended limit

**Example:**

```
Current SOL Value: $10.00
MAX_POSITION_VALUE_USDT: $10
→ Position limit reached → Buy skipped
```

## Execution Priority

Risk management checks run **BEFORE** normal trading logic:

1. **Emergency Stop-Loss Check** (HIGHEST PRIORITY)

   - If portfolio down ≥ 15% from startup → **SELL ALL SOL immediately**
   - Works even with 0 trades (uses startup balance)
   - No further checks after this

2. **Maximum Drawdown Check**

   - If portfolio down ≥ 10% from startup → Trading paused, no further checks

3. **Stop-Loss Check** (if holding SOL, requires trades)

   - If triggered → Immediate SELL, no further checks

4. **Take-Profit Check** (if holding SOL)

   - If triggered → Immediate SELL, no further checks

5. **Position Size Limit Check** (before BUY)

   - If exceeded → Buy skipped

6. **Normal Trading Logic**
   - Confidence checks
   - Prediction signal execution
   - Regular BUY/SELL/HOLD

## Configuration

Add these to your `.env` file:

```env
# Risk Management
MAX_POSITION_VALUE_USDT=10        # Maximum total value in SOL position
STOP_LOSS_PERCENT=5               # Stop loss: sell if down X% from entry (requires trades)
MAX_DRAWDOWN_PERCENT=10           # Maximum drawdown: pause if portfolio down X%
TAKE_PROFIT_PERCENT=20            # Take profit: sell if up X% from entry
EMERGENCY_STOP_LOSS_PERCENT=15    # Emergency stop-loss: sell ALL if portfolio down X% from startup (works even without trades)
```

## How It Handles Your -11% Loss

With these features, here's what happens:

### Scenario 1: Loss is from holding SOL (unrealized, 0 trades)

- **Emergency Stop-Loss**: If portfolio down ≥ 15% from startup → **SELL ALL SOL immediately**
- **Maximum Drawdown**: If portfolio down ≥ 10% from startup → Trading paused
- **Your Current Situation**: -11.43% loss
  - Below 15% emergency threshold → No emergency sell yet
  - Above 10% maximum drawdown → Trading will be paused
  - **Next Hour**: Bot will pause trading (won't buy/sell based on predictions)

### Scenario 2: Loss is from trading (realized, has trades)

- **Emergency Stop-Loss**: If portfolio down ≥ 15% from startup → **SELL ALL SOL immediately**
- **Stop-Loss**: If position down ≥ 5% from entry price → Sell automatically
- **Maximum Drawdown**: If portfolio down ≥ 10% from startup → Trading paused

## Benefits

✅ **Automatic Loss Limiting**: No need to manually monitor - bot cuts losses automatically
✅ **Profit Protection**: Automatically locks in profits when targets are reached
✅ **Position Control**: Prevents over-investing beyond your limit
✅ **Capital Protection**: Maximum drawdown prevents catastrophic losses

## Important Notes

- **Hourly Checks**: Risk management checks run every hour (not real-time)
- **Average Entry Price**: Uses FIFO matching to calculate true entry price
- **Override Logic**: Stop-loss and take-profit override normal prediction signals
- **MongoDB Required**: Maximum drawdown requires MongoDB to track startup balance

## Recommendations

For your current -11.43% situation:

- **Emergency Stop-Loss**: Set to 15% (default) - **will sell ALL SOL if drops to -15%**
- **Maximum Drawdown**: Set to 10% (default) - **currently triggered, trading paused**
- **Stop-Loss**: Set to 5% (default) - requires trades to work (you have 0 trades)
- **Take-Profit**: Set to 20% (default) - will lock profits on recovery

**Current Status**:

- Your portfolio is down 11.43% from startup
- Maximum drawdown (10%) is triggered → Trading is paused
- If portfolio drops to -15%, emergency stop-loss will sell all SOL immediately

The bot will now automatically protect you from further losses!
