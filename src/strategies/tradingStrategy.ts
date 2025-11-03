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
  private readonly TRADE_AMOUNT_USDT = parseFloat(
    process.env.TRADE_AMOUNT_USDT || "100"
  );

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

    // Check if we have enough USDT
    const tradeAmount = Math.min(this.TRADE_AMOUNT_USDT, usdtBalance * 0.95); // Use 95% to account for fees

    if (tradeAmount < 10) {
      const reason: SkipReason = {
        reason: "INSUFFICIENT_BALANCE_BUY",
        details: {
          availableBalance: usdtBalance,
          requiredAmount: tradeAmount,
          minTradeAmount: 10,
          explanation: "Not enough USDT balance for buy order",
        },
        timestamp: new Date(),
      };
      skipReasons.push(reason);
      logger.warn(
        `⚠️  Insufficient USDT balance (${usdtBalance.toFixed(2)}), cannot buy`
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
      if (process.env.USE_MARKET_ORDERS === "true") {
        orderResult = await this.binanceService.buyMarket(
          this.TRADING_PAIR,
          quantity
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
      const reason: SkipReason = {
        reason: "BUY_EXECUTION_ERROR",
        details: {
          errorMessage: error.message,
          errorCode: error.code,
          attemptedQuantity: quantity,
          attemptedAmount: tradeAmount,
        },
        timestamp: new Date(),
      };
      skipReasons.push(reason);
      logger.error(`❌ Buy execution failed:`, error.message);
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
}
