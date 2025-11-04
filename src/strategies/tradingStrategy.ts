import { BinanceService } from "../services/binanceService.js";
import { Prediction } from "../algorithms/predictionAlgorithm.js";
import { MarketData } from "../services/binanceService.js";
import { logger } from "../utils/logger.js";
import { ProfitTracker } from "../utils/profitTracker.js";
import { SkipReason, TradeDetails } from "../services/mongodbService.js";

export interface StrategyExecutionResult {
  traded: boolean;
  skipReasons?: SkipReason[];
  tradeDetails?: TradeDetails;
}

export class TradingStrategy {
  private binanceService: BinanceService;
  private profitTracker: ProfitTracker;
  private readonly TRADING_PAIR = "SOLUSDT";
  private readonly BASE_ASSET = "SOL";
  private readonly QUOTE_ASSET = "USDT";
  private readonly MIN_CONFIDENCE = parseInt(
    process.env.MIN_CONFIDENCE || "50",
    10
  );
  private readonly MAX_POSITION_VALUE_USDT = parseFloat(
    process.env.MAX_POSITION_VALUE_USDT || "10"
  ); // Maximum total value in SOL position
  private readonly STOP_LOSS_PERCENT = parseFloat(
    process.env.STOP_LOSS_PERCENT || "5"
  ); // Stop loss: sell if position is down X% from entry
  private readonly MAX_DRAWDOWN_PERCENT = parseFloat(
    process.env.MAX_DRAWDOWN_PERCENT || "10"
  ); // Maximum drawdown: pause trading if portfolio is down X% from startup
  private readonly TAKE_PROFIT_PERCENT = parseFloat(
    process.env.TAKE_PROFIT_PERCENT || "15"
  ); // Take profit: sell if position is up X% from entry

  constructor(binanceService: BinanceService) {
    this.binanceService = binanceService;
    this.profitTracker = new ProfitTracker();
  }

  /**
   * Execute trading strategy based on prediction
   */
  async execute(
    prediction: Prediction,
    marketData: MarketData
  ): Promise<StrategyExecutionResult> {
    const skipReasons: SkipReason[] = [];

    // Get current balances
    const solBalance = await this.binanceService.getBalance(this.BASE_ASSET);
    const usdtBalance = await this.binanceService.getBalance(this.QUOTE_ASSET);
    const totalValue = solBalance * marketData.price + usdtBalance;

    // Set initial balance on first run
    await this.profitTracker.setInitialBalance(solBalance, usdtBalance);

    logger.info(
      `💰 Current Balances: ${solBalance.toFixed(4)} ${
        this.BASE_ASSET
      } | ${usdtBalance.toFixed(2)} ${
        this.QUOTE_ASSET
      } | Total: $${totalValue.toFixed(2)}`
    );

    // ============================================
    // RISK MANAGEMENT CHECKS (Priority 1)
    // ============================================

    // 1. Check Maximum Drawdown Protection
    const drawdownResult = await this.checkMaximumDrawdown(totalValue);
    if (drawdownResult.shouldPause) {
      logger.warn(
        `🚨 MAX DRAWDOWN HIT: Portfolio down ${drawdownResult.drawdownPercent.toFixed(
          2
        )}% from startup. Trading paused for safety.`
      );
      return {
        traded: false,
        skipReasons: [
          {
            reason: "MAX_DRAWDOWN_EXCEEDED",
            details: {
              drawdownPercent: drawdownResult.drawdownPercent,
              maxDrawdown: this.MAX_DRAWDOWN_PERCENT,
              currentValue: totalValue,
              startupValue: drawdownResult.startupValue,
              explanation: `Portfolio down ${drawdownResult.drawdownPercent.toFixed(
                2
              )}% from startup, exceeding maximum drawdown of ${
                this.MAX_DRAWDOWN_PERCENT
              }%`,
            },
            timestamp: new Date(),
          },
        ],
      };
    }

    // 2. Check Stop-Loss Protection (if holding SOL)
    if (solBalance > 0.001) {
      const stopLossResult = await this.checkStopLoss(
        solBalance,
        marketData.price
      );
      if (stopLossResult.shouldSell) {
        logger.warn(
          `🛑 STOP-LOSS TRIGGERED: Position down ${stopLossResult.lossPercent.toFixed(
            2
          )}% from average entry. Forcing sell to limit losses.`
        );
        // Force sell regardless of prediction
        return await this.executeSell(
          solBalance,
          marketData.price,
          usdtBalance,
          {
            ...prediction,
            signal: "SELL",
            confidence: 100, // Override confidence for stop-loss
            reasoning: [
              `Stop-loss triggered: ${stopLossResult.lossPercent.toFixed(
                2
              )}% loss from entry price $${stopLossResult.avgEntryPrice.toFixed(
                2
              )}`,
            ],
          } as Prediction,
          marketData
        );
      }
    }

    // 3. Check Take-Profit Protection (if holding SOL)
    if (solBalance > 0.001) {
      const takeProfitResult = await this.checkTakeProfit(
        solBalance,
        marketData.price
      );
      if (takeProfitResult.shouldSell) {
        logger.info(
          `💰 TAKE-PROFIT TRIGGERED: Position up ${takeProfitResult.profitPercent.toFixed(
            2
          )}% from average entry. Taking profit.`
        );
        // Force sell to take profit
        return await this.executeSell(
          solBalance,
          marketData.price,
          usdtBalance,
          {
            ...prediction,
            signal: "SELL",
            confidence: 100, // Override confidence for take-profit
            reasoning: [
              `Take-profit triggered: ${takeProfitResult.profitPercent.toFixed(
                2
              )}% profit from entry price $${takeProfitResult.avgEntryPrice.toFixed(
                2
              )}`,
            ],
          } as Prediction,
          marketData
        );
      }
    }

    // 4. Check Position Size Limit (before buying)
    if (prediction.signal === "BUY") {
      const currentPositionValue = solBalance * marketData.price;
      if (currentPositionValue >= this.MAX_POSITION_VALUE_USDT) {
        logger.info(
          `⏸️  Position limit reached: ${currentPositionValue.toFixed(
            2
          )} USDT >= ${this.MAX_POSITION_VALUE_USDT} USDT max. Skipping buy.`
        );
        return {
          traded: false,
          skipReasons: [
            {
              reason: "POSITION_LIMIT_REACHED",
              details: {
                currentPositionValue,
                maxPositionValue: this.MAX_POSITION_VALUE_USDT,
                explanation: `Current position value (${currentPositionValue.toFixed(
                  2
                )} USDT) equals or exceeds maximum allowed (${
                  this.MAX_POSITION_VALUE_USDT
                } USDT)`,
              },
              timestamp: new Date(),
            },
          ],
        };
      }
    }

    // Check if prediction confidence is high enough
    if (prediction.confidence < this.MIN_CONFIDENCE) {
      const reason: SkipReason = {
        reason: "LOW_CONFIDENCE",
        details: {
          confidence: prediction.confidence,
          minConfidence: this.MIN_CONFIDENCE,
          threshold: `${prediction.confidence}% < ${this.MIN_CONFIDENCE}%`,
        },
        timestamp: new Date(),
      };
      skipReasons.push(reason);
      logger.info(
        `⏸️  Confidence too low (${prediction.confidence}% < ${this.MIN_CONFIDENCE}%), skipping trade`
      );
      return { traded: false, skipReasons };
    }

    // Check if we should trade based on signal
    if (prediction.signal === "HOLD") {
      const reason: SkipReason = {
        reason: "HOLD_SIGNAL",
        details: {
          signal: prediction.signal,
          explanation: "Indicators are mixed, holding position",
        },
        timestamp: new Date(),
      };
      skipReasons.push(reason);
      logger.info("⏸️  Signal is HOLD, no action taken");
      return { traded: false, skipReasons };
    }

    // Execute based on signal
    if (prediction.signal === "BUY") {
      const result = await this.executeBuy(
        usdtBalance,
        marketData.price,
        solBalance,
        prediction,
        marketData
      );
      return result;
    } else if (prediction.signal === "SELL") {
      const result = await this.executeSell(
        solBalance,
        marketData.price,
        usdtBalance,
        prediction,
        marketData
      );
      return result;
    }

    // Edge case: signal is not BUY, SELL, or HOLD (shouldn't happen normally)
    if (skipReasons.length === 0) {
      skipReasons.push({
        reason: "UNKNOWN_SIGNAL",
        details: {
          signal: prediction.signal,
          explanation: "Signal type is not recognized",
        },
        timestamp: new Date(),
      });
    }

    return { traded: false, skipReasons };
  }

  /**
   * Execute buy strategy
   */
  private async executeBuy(
    usdtBalance: number,
    currentPrice: number,
    solBalanceBefore: number,
    prediction: Prediction,
    marketData: MarketData
  ): Promise<StrategyExecutionResult> {
    const skipReasons: SkipReason[] = [];

    // Check position size limit - ensure we don't exceed MAX_POSITION_VALUE_USDT
    const currentPositionValue = solBalanceBefore * currentPrice;
    const remainingPositionCapacity = Math.max(
      0,
      this.MAX_POSITION_VALUE_USDT - currentPositionValue
    );

    // Calculate trade amount - don't exceed remaining capacity
    const maxTradeAmount = Math.min(
      remainingPositionCapacity,
      usdtBalance * 0.95
    ); // Use 95% to account for fees

    if (remainingPositionCapacity <= 0) {
      const reason: SkipReason = {
        reason: "POSITION_LIMIT_REACHED",
        details: {
          currentPositionValue,
          maxPositionValue: this.MAX_POSITION_VALUE_USDT,
          explanation: `Current position value (${currentPositionValue.toFixed(
            2
          )} USDT) equals or exceeds maximum allowed (${
            this.MAX_POSITION_VALUE_USDT
          } USDT)`,
        },
        timestamp: new Date(),
      };
      skipReasons.push(reason);
      logger.warn(
        `⚠️  Position limit reached (${currentPositionValue.toFixed(2)} >= ${
          this.MAX_POSITION_VALUE_USDT
        }), cannot buy more`
      );
      return { traded: false, skipReasons };
    }

    // Check if we have enough USDT for minimum trade
    const tradeAmount = Math.min(maxTradeAmount, remainingPositionCapacity);

    if (tradeAmount < 10) {
      const reason: SkipReason = {
        reason: "INSUFFICIENT_BALANCE_BUY",
        details: {
          availableBalance: usdtBalance,
          requiredAmount: tradeAmount,
          minTradeAmount: 10,
          remainingCapacity: remainingPositionCapacity,
          explanation: `Not enough USDT balance or remaining position capacity (${remainingPositionCapacity.toFixed(
            2
          )} USDT) for buy order. Minimum: $10`,
        },
        timestamp: new Date(),
      };
      skipReasons.push(reason);
      logger.warn(
        `⚠️  Insufficient capacity (${tradeAmount.toFixed(
          2
        )} USDT available, need $10 minimum), cannot buy`
      );
      return { traded: false, skipReasons };
    }

    // Calculate quantity to buy
    const quantity = tradeAmount / currentPrice;

    logger.info(
      `🟢 BUY Strategy: Using ${tradeAmount.toFixed(
        2
      )} USDT to buy ~${quantity.toFixed(4)} ${this.BASE_ASSET}`
    );

    const balanceBefore = {
      sol: solBalanceBefore,
      usdt: usdtBalance,
      totalValue: solBalanceBefore * currentPrice + usdtBalance,
    };

    try {
      let orderResult: any = null;

      // Option 1: Market Buy (immediate execution)
      // Use quoteOrderQty (USDT amount) for MARKET BUY orders (Binance requirement)
      if (process.env.USE_MARKET_ORDERS === "true") {
        orderResult = await this.binanceService.buyMarket(
          this.TRADING_PAIR,
          quantity,
          tradeAmount // Pass USDT amount as quoteOrderQty for MARKET BUY
        );
      }
      // Option 2: Limit Buy (set below current price)
      else {
        const limitPrice = currentPrice * 0.995; // 0.5% below market price
        orderResult = await this.binanceService.buyLimit(
          this.TRADING_PAIR,
          quantity,
          limitPrice
        );
      }

      // Get balances after trade
      const solBalanceAfter = await this.binanceService.getBalance(
        this.BASE_ASSET
      );
      const usdtBalanceAfter = await this.binanceService.getBalance(
        this.QUOTE_ASSET
      );

      const balanceAfter = {
        sol: solBalanceAfter,
        usdt: usdtBalanceAfter,
        totalValue: solBalanceAfter * currentPrice + usdtBalanceAfter,
      };

      // Record the trade
      await this.profitTracker.recordBuy(
        this.TRADING_PAIR,
        quantity,
        currentPrice,
        tradeAmount,
        balanceBefore,
        balanceAfter
      );

      // Create detailed trade information
      const tradeDetails: TradeDetails = {
        signal: prediction.signal,
        type: "BUY",
        confidence: prediction.confidence,
        quantity: quantity,
        price: currentPrice,
        amount: tradeAmount,
        balanceBefore,
        balanceAfter,
        tradingPair: this.TRADING_PAIR,
        orderId: orderResult?.orderId?.toString(),
      };

      return { traded: true, tradeDetails };
    } catch (error: any) {
      const errorDetails = {
        errorMessage: error?.message || "Unknown error",
        errorCode: error?.code,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        attemptedQuantity: quantity,
        attemptedAmount: tradeAmount,
      };

      const reason: SkipReason = {
        reason: "BUY_EXECUTION_ERROR",
        details: errorDetails,
        timestamp: new Date(),
      };
      skipReasons.push(reason);

      logger.error(
        `❌ Buy execution failed:`,
        JSON.stringify(errorDetails, null, 2)
      );
      logger.error(`Error details: ${error?.message || "Unknown error"}`);

      return { traded: false, skipReasons };
    }
  }

  /**
   * Execute sell strategy
   */
  private async executeSell(
    solBalance: number,
    currentPrice: number,
    usdtBalanceBefore: number,
    prediction: Prediction,
    marketData: MarketData
  ): Promise<StrategyExecutionResult> {
    const skipReasons: SkipReason[] = [];

    // Check if we have enough SOL to sell
    const minTradeAmount = 0.01; // Minimum SOL trade amount
    const tradeQuantity = Math.min(solBalance * 0.95, solBalance); // Use 95% to account for fees

    if (tradeQuantity < minTradeAmount) {
      const reason: SkipReason = {
        reason: "INSUFFICIENT_BALANCE_SELL",
        details: {
          availableBalance: solBalance,
          requiredQuantity: tradeQuantity,
          minTradeAmount: 0.01,
          explanation: "Not enough SOL balance for sell order",
        },
        timestamp: new Date(),
      };
      skipReasons.push(reason);
      logger.warn(
        `⚠️  Insufficient ${this.BASE_ASSET} balance (${solBalance.toFixed(
          4
        )}), cannot sell`
      );
      return { traded: false, skipReasons };
    }

    logger.info(
      `🔴 SELL Strategy: Selling ${tradeQuantity.toFixed(4)} ${this.BASE_ASSET}`
    );

    const balanceBefore = {
      sol: solBalance,
      usdt: usdtBalanceBefore,
      totalValue: solBalance * currentPrice + usdtBalanceBefore,
    };

    // Calculate expected sell amount (approximate)
    const expectedAmount = tradeQuantity * currentPrice;

    try {
      let orderResult: any = null;

      // Option 1: Market Sell (immediate execution)
      if (process.env.USE_MARKET_ORDERS === "true") {
        orderResult = await this.binanceService.sellMarket(
          this.TRADING_PAIR,
          tradeQuantity
        );
      }
      // Option 2: Limit Sell (set above current price)
      else {
        const limitPrice = currentPrice * 1.005; // 0.5% above market price
        orderResult = await this.binanceService.sellLimit(
          this.TRADING_PAIR,
          tradeQuantity,
          limitPrice
        );
      }

      // Get balances after trade
      const solBalanceAfter = await this.binanceService.getBalance(
        this.BASE_ASSET
      );
      const usdtBalanceAfter = await this.binanceService.getBalance(
        this.QUOTE_ASSET
      );

      const balanceAfter = {
        sol: solBalanceAfter,
        usdt: usdtBalanceAfter,
        totalValue: solBalanceAfter * currentPrice + usdtBalanceAfter,
      };

      // Calculate actual amount received
      const actualAmount = usdtBalanceAfter - usdtBalanceBefore;

      // Record the trade
      await this.profitTracker.recordSell(
        this.TRADING_PAIR,
        tradeQuantity,
        currentPrice,
        actualAmount,
        balanceBefore,
        balanceAfter
      );

      // Create detailed trade information
      const tradeDetails: TradeDetails = {
        signal: prediction.signal,
        type: "SELL",
        confidence: prediction.confidence,
        quantity: tradeQuantity,
        price: currentPrice,
        amount: actualAmount,
        balanceBefore,
        balanceAfter,
        tradingPair: this.TRADING_PAIR,
        orderId: orderResult?.orderId?.toString(),
      };

      return { traded: true, tradeDetails };
    } catch (error: any) {
      const reason: SkipReason = {
        reason: "SELL_EXECUTION_ERROR",
        details: {
          errorMessage: error.message,
          errorCode: error.code,
          attemptedQuantity: tradeQuantity,
          attemptedAmount: expectedAmount,
        },
        timestamp: new Date(),
      };
      skipReasons.push(reason);
      logger.error(`❌ Sell execution failed:`, error.message);
      return { traded: false, skipReasons };
    }
  }

  /**
   * Check maximum drawdown protection
   */
  private async checkMaximumDrawdown(currentTotalValue: number): Promise<{
    shouldPause: boolean;
    drawdownPercent: number;
    startupValue: number;
  }> {
    // Get startup balance from MongoDB
    const { MongoService } = await import("../services/mongodbService.js");
    const mongoService = new MongoService();
    await mongoService.connect();

    const startupBalance = await mongoService.getStartupBalance();
    if (!startupBalance) {
      // No startup balance recorded yet, can't calculate drawdown
      return { shouldPause: false, drawdownPercent: 0, startupValue: 0 };
    }

    const startupValue = startupBalance.balances.totalValue;
    const drawdown = startupValue - currentTotalValue;
    const drawdownPercent = (drawdown / startupValue) * 100;

    const shouldPause = drawdownPercent >= this.MAX_DRAWDOWN_PERCENT;

    return { shouldPause, drawdownPercent, startupValue };
  }

  /**
   * Check stop-loss protection for current SOL position
   */
  private async checkStopLoss(
    solBalance: number,
    currentPrice: number
  ): Promise<{
    shouldSell: boolean;
    lossPercent: number;
    avgEntryPrice: number;
  }> {
    const avgEntryPrice = this.profitTracker.getAverageEntryPrice();

    if (avgEntryPrice === 0) {
      // No entry price available (no unmatched buys)
      return { shouldSell: false, lossPercent: 0, avgEntryPrice: 0 };
    }

    // Calculate current loss percentage
    const lossPercent = ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100;

    const shouldSell = lossPercent <= -this.STOP_LOSS_PERCENT;

    return { shouldSell, lossPercent, avgEntryPrice };
  }

  /**
   * Check take-profit protection for current SOL position
   */
  private async checkTakeProfit(
    solBalance: number,
    currentPrice: number
  ): Promise<{
    shouldSell: boolean;
    profitPercent: number;
    avgEntryPrice: number;
  }> {
    const avgEntryPrice = this.profitTracker.getAverageEntryPrice();

    if (avgEntryPrice === 0) {
      // No entry price available (no unmatched buys)
      return { shouldSell: false, profitPercent: 0, avgEntryPrice: 0 };
    }

    // Calculate current profit percentage
    const profitPercent =
      ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100;

    const shouldSell = profitPercent >= this.TAKE_PROFIT_PERCENT;

    return { shouldSell, profitPercent, avgEntryPrice };
  }
}
