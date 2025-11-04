# Risk Management Features

## Overview

The bot now includes comprehensive risk management features to protect your capital and limit losses.

## Implemented Features

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

1. **Maximum Drawdown Check** (highest priority)

   - If exceeded → Trading paused, no further checks

2. **Stop-Loss Check** (if holding SOL)

   - If triggered → Immediate SELL, no further checks

3. **Take-Profit Check** (if holding SOL)

   - If triggered → Immediate SELL, no further checks

4. **Position Size Limit Check** (before BUY)

   - If exceeded → Buy skipped

5. **Normal Trading Logic**
   - Confidence checks
   - Prediction signal execution
   - Regular BUY/SELL/HOLD

## Configuration

Add these to your `.env` file:

```env
# Risk Management
MAX_POSITION_VALUE_USDT=10        # Maximum total value in SOL position
STOP_LOSS_PERCENT=5               # Stop loss: sell if down X% from entry
MAX_DRAWDOWN_PERCENT=10           # Maximum drawdown: pause if portfolio down X%
TAKE_PROFIT_PERCENT=15            # Take profit: sell if up X% from entry
```

## How It Handles Your -9% Loss

With these features, here's what happens:

### Scenario 1: Loss is from holding SOL (unrealized)

- **Stop-Loss Check**: If your average entry price results in a loss ≥ 5%, it will sell automatically
- **Maximum Drawdown**: If total portfolio is down ≥ 10% from startup, trading pauses
- **Next Hour**: Bot checks all risk management rules and acts accordingly

### Scenario 2: Loss is from trading (realized)

- The bot will check stop-loss on every cycle
- If you're down ≥ 5% from entry, it will sell immediately
- Maximum drawdown will pause trading if total portfolio down ≥ 10%

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

For your current -9% situation:

- **Stop-Loss**: Set to 5% (default) - will sell if position drops further
- **Maximum Drawdown**: Set to 10% (default) - will pause at -10% total
- **Take-Profit**: Set to 15% (default) - will lock profits on recovery

The bot will now automatically protect you from further losses!
