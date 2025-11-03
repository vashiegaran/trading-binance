import { logger } from "../utils/logger.js";
import { BinanceService } from "../services/binanceService.js";
import { PredictionAlgorithm } from "../algorithms/predictionAlgorithm.js";
import { TradingStrategy } from "../strategies/tradingStrategy.js";
import { ProfitTracker } from "../utils/profitTracker.js";
import { MongoService, HourDecision } from "../services/mongodbService.js";

export class TradingBot {
  private binanceService: BinanceService;
  private predictionAlgorithm: PredictionAlgorithm;
  private tradingStrategy: TradingStrategy;
  private profitTracker: ProfitTracker;
  private mongoService: MongoService;

  constructor() {
    this.binanceService = new BinanceService();
    this.predictionAlgorithm = new PredictionAlgorithm();
    this.tradingStrategy = new TradingStrategy(this.binanceService);
    this.profitTracker = new ProfitTracker();
    this.mongoService = new MongoService();
    // Connect to MongoDB (non-blocking, but ensure connection before saves)
    this.mongoService
      .connect()
      .then(() => {
        logger.debug("✅ MongoDB connection established in TradingBot");
      })
      .catch((err) => {
        logger.warn(`⚠️  MongoDB connection failed: ${err.message}`);
      });
  }

  async execute(): Promise<void> {
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logger.info("🔄 Starting trading cycle...");

    const cycleStartTime = Date.now();

    try {
      // Step 1: Fetch current market data
      logger.info("📊 Fetching market data for SOL/USDT...");
      const marketData = await this.binanceService.getMarketData("SOLUSDT");

      // Step 2: Analyze and predict
      logger.info("🔮 Running prediction algorithm...");
      const prediction = await this.predictionAlgorithm.predict(marketData);

      // Step 3: Execute trading strategy
      logger.info("💼 Executing trading strategy...");
      const strategyResult = await this.tradingStrategy.execute(
        prediction,
        marketData
      );

      // Step 4: Show profit summary
      const solBalance = await this.binanceService.getBalance("SOL");
      const usdtBalance = await this.binanceService.getBalance("USDT");
      const totalValue = solBalance * marketData.price + usdtBalance;

      logger.info(
        `💰 Current Balances: ${solBalance.toFixed(
          4
        )} SOL | ${usdtBalance.toFixed(2)} USDT | Total: $${totalValue.toFixed(
          2
        )}`
      );

      this.profitTracker.logSummary(
        { sol: solBalance, usdt: usdtBalance },
        marketData.price
      );

      // Step 5: Get previous decision for comparison
      const previousDecision = await this.mongoService.getHourDecisions(
        undefined,
        undefined,
        undefined,
        1
      );

      // Step 6: Calculate analytics - previous vs current
      const previousBalances =
        previousDecision.length > 0 ? previousDecision[0].balances : undefined;
      const previousPrice =
        previousDecision.length > 0
          ? previousDecision[0].marketData?.price
          : undefined;
      const previousTimestamp =
        previousDecision.length > 0 ? previousDecision[0].timestamp : undefined;

      // Calculate value changes
      const analytics: HourDecision["analytics"] = {
        previousBalances,
        previousPrice,
        previousTimestamp,
      };

      if (previousBalances) {
        analytics.valueChange = {
          sol: {
            amount: solBalance - previousBalances.sol,
            percent:
              previousBalances.sol > 0
                ? ((solBalance - previousBalances.sol) / previousBalances.sol) *
                  100
                : 0,
          },
          usdt: {
            amount: usdtBalance - previousBalances.usdt,
            percent:
              previousBalances.usdt > 0
                ? ((usdtBalance - previousBalances.usdt) /
                    previousBalances.usdt) *
                  100
                : 0,
          },
          total: {
            amount: totalValue - previousBalances.totalValue,
            percent:
              previousBalances.totalValue > 0
                ? ((totalValue - previousBalances.totalValue) /
                    previousBalances.totalValue) *
                  100
                : 0,
          },
        };
      }

      if (previousPrice) {
        analytics.priceChange = {
          amount: marketData.price - previousPrice,
          percent:
            previousPrice > 0
              ? ((marketData.price - previousPrice) / previousPrice) * 100
              : 0,
        };
      }

      // Generate detailed skip analysis
      if (!strategyResult.traded) {
        analytics.detailedSkipAnalysis = this.generateDetailedSkipAnalysis(
          strategyResult.skipReasons || [],
          prediction,
          marketData,
          analytics.valueChange,
          analytics.priceChange
        );
      }

      // Generate decision explanation
      analytics.decisionExplanation = this.generateDecisionExplanation(
        prediction,
        strategyResult.traded,
        strategyResult.skipReasons || []
      );

      // Step 7: Save hour decision with full analytics to MongoDB
      const executionTime = Date.now() - cycleStartTime;

      const hourDecision: HourDecision = {
        timestamp: new Date(),
        decision: strategyResult.traded ? "TRADED" : "SKIPPED",
        skipReasons: strategyResult.skipReasons || [],
        tradeDetails: strategyResult.tradeDetails,
        prediction: prediction,
        marketData: marketData,
        balances: {
          sol: solBalance,
          usdt: usdtBalance,
          totalValue: totalValue,
        },
        executionTime: executionTime,
        analytics: analytics,
      };

      // Step 7: Save hour decision with full analytics to MongoDB
      const hourDecisionId = await this.mongoService.saveHourDecision(
        hourDecision
      );

      // Step 8: Log detailed analytics
      this.logDetailedAnalytics(hourDecision);

      // Step 9: Save bot snapshot to MongoDB with hour_decision reference
      await this.mongoService.saveBotSnapshot({
        marketData,
        balances: { sol: solBalance, usdt: usdtBalance },
        prediction,
        botStatus: "running",
        hourDecisionId: hourDecisionId || undefined,
        hourDecision: {
          decision: hourDecision.decision,
          skipReasons: hourDecision.skipReasons,
          tradeDetails: hourDecision.tradeDetails,
        },
      });

      // Step 10: Aggregate hourly metrics
      await this.mongoService.aggregateHourlyMetrics();

      logger.info("✅ Trading cycle completed successfully");
      logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    } catch (error: any) {
      const executionTime = Date.now() - cycleStartTime;

      // Try to save error details to MongoDB
      try {
        const solBalance = await this.binanceService.getBalance("SOL");
        const usdtBalance = await this.binanceService.getBalance("USDT");
        const totalValue =
          solBalance *
            (await this.binanceService.getMarketData("SOLUSDT")).price +
          usdtBalance;

        const errorDecision: HourDecision = {
          timestamp: new Date(),
          decision: "SKIPPED",
          skipReasons: [
            {
              reason: "EXECUTION_ERROR",
              details: {
                errorMessage: error.message,
                errorStack: error.stack,
              },
              timestamp: new Date(),
            },
          ],
          prediction: {} as any,
          marketData: {} as any,
          balances: {
            sol: solBalance,
            usdt: usdtBalance,
            totalValue: totalValue,
          },
          executionTime: executionTime,
          errorDetails: {
            message: error.message,
            stack: error.stack,
            timestamp: new Date(),
          },
        };

        await this.mongoService.saveHourDecision(errorDecision);
        // Also aggregate metrics even if there was an error
        await this.mongoService.aggregateHourlyMetrics().catch(() => {
          // Ignore errors when aggregating metrics
        });
      } catch (innerError) {
        // Ignore errors when saving error details
      }

      logger.error("❌ Error in trading cycle:", error);
      throw error;
    }
  }

  /**
   * Generate detailed skip analysis explaining why trade was skipped
   */
  private generateDetailedSkipAnalysis(
    skipReasons: any[],
    prediction: any,
    marketData: any,
    valueChange?: any,
    priceChange?: any
  ): string {
    const parts: string[] = [];

    // Market movement analysis
    if (priceChange) {
      if (priceChange.amount > 0) {
        parts.push(
          `📈 SOL price increased by $${priceChange.amount.toFixed(
            2
          )} (${priceChange.percent.toFixed(2)}%)`
        );
      } else if (priceChange.amount < 0) {
        parts.push(
          `📉 SOL price decreased by $${Math.abs(priceChange.amount).toFixed(
            2
          )} (${Math.abs(priceChange.percent).toFixed(2)}%)`
        );
      } else {
        parts.push(`➡️ SOL price unchanged`);
      }
    }

    // Portfolio value analysis
    if (valueChange?.total) {
      if (valueChange.total.amount > 0) {
        parts.push(
          `💰 Portfolio value increased by $${valueChange.total.amount.toFixed(
            2
          )} (${valueChange.total.percent.toFixed(2)}%)`
        );
      } else if (valueChange.total.amount < 0) {
        parts.push(
          `💸 Portfolio value decreased by $${Math.abs(
            valueChange.total.amount
          ).toFixed(2)} (${Math.abs(valueChange.total.percent).toFixed(2)}%)`
        );
      }
    }

    // Prediction analysis
    parts.push(
      `🔮 Prediction: ${prediction.signal} with ${prediction.confidence}% confidence`
    );
    if (prediction.reasoning && prediction.reasoning.length > 0) {
      parts.push(`   Indicators: ${prediction.reasoning.join("; ")}`);
    }

    // Skip reasons detailed explanation
    if (skipReasons.length > 0) {
      parts.push(`\n🚫 Skip Reasons:`);
      skipReasons.forEach((reason, index) => {
        parts.push(`   ${index + 1}. ${reason.reason}`);
        if (reason.details) {
          if (reason.reason === "LOW_CONFIDENCE") {
            parts.push(
              `      → Confidence ${reason.details.confidence}% is below minimum ${reason.details.minConfidence}% threshold`
            );
          } else if (reason.reason === "HOLD_SIGNAL") {
            parts.push(
              `      → ${reason.details.explanation || "Indicators are mixed"}`
            );
          } else if (reason.reason === "INSUFFICIENT_BALANCE_BUY") {
            parts.push(
              `      → Only $${reason.details.availableBalance.toFixed(
                2
              )} USDT available, need $${
                reason.details.minTradeAmount || 10
              } minimum`
            );
          } else if (reason.reason === "INSUFFICIENT_BALANCE_SELL") {
            parts.push(
              `      → Only ${reason.details.availableBalance.toFixed(
                4
              )} SOL available, need ${
                reason.details.minTradeAmount || 0.01
              } minimum`
            );
          } else if (reason.details.errorMessage) {
            parts.push(`      → Error: ${reason.details.errorMessage}`);
          }
        }
      });
    }

    // Why it skipped even if value increased
    if (
      valueChange?.total &&
      valueChange.total.amount > 0 &&
      priceChange &&
      priceChange.amount > 0
    ) {
      parts.push(
        `\n💡 Note: Portfolio value increased, but trade was skipped because:`
      );
      if (skipReasons.some((r) => r.reason === "LOW_CONFIDENCE")) {
        parts.push(
          `   - Prediction confidence too low - not confident enough in the signal despite price increase`
        );
      }
      if (skipReasons.some((r) => r.reason === "HOLD_SIGNAL")) {
        parts.push(
          `   - Indicators are mixed - conflicting signals suggest waiting for clearer direction`
        );
      }
      parts.push(
        `   - Conservative approach: Better to skip than trade with low confidence, even if price moves favorably`
      );
    }

    return parts.join("\n");
  }

  /**
   * Generate decision explanation
   */
  private generateDecisionExplanation(
    prediction: any,
    traded: boolean,
    skipReasons: any[]
  ): string {
    if (traded) {
      return `Executed ${prediction.signal} signal with ${
        prediction.confidence
      }% confidence. ${prediction.reasoning?.join("; ") || ""}`;
    } else {
      const reasons = skipReasons.map((r) => r.reason).join(", ");
      return `Skipped trade. Signal: ${prediction.signal}, Confidence: ${
        prediction.confidence
      }%. Reasons: ${reasons}. ${prediction.reasoning?.join("; ") || ""}`;
    }
  }

  /**
   * Log detailed analytics to console
   */
  private logDetailedAnalytics(decision: HourDecision): void {
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logger.info("📊 DETAILED ANALYTICS");
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (decision.analytics?.previousBalances) {
      logger.info("📈 VALUE COMPARISON:");
      logger.info(
        `   Previous: ${decision.analytics.previousBalances.sol.toFixed(
          4
        )} SOL + ${decision.analytics.previousBalances.usdt.toFixed(
          2
        )} USDT = $${decision.analytics.previousBalances.totalValue.toFixed(2)}`
      );
      logger.info(
        `   Current:  ${decision.balances.sol.toFixed(
          4
        )} SOL + ${decision.balances.usdt.toFixed(
          2
        )} USDT = $${decision.balances.totalValue.toFixed(2)}`
      );

      if (decision.analytics.valueChange) {
        const change = decision.analytics.valueChange.total;
        const symbol = change.amount >= 0 ? "📈" : "📉";
        logger.info(
          `   ${symbol} Change: $${
            change.amount >= 0 ? "+" : ""
          }${change.amount.toFixed(2)} (${
            change.percent >= 0 ? "+" : ""
          }${change.percent.toFixed(2)}%)`
        );
      }
    }

    if (decision.analytics?.priceChange) {
      const change = decision.analytics.priceChange;
      const symbol = change.amount >= 0 ? "📈" : "📉";
      logger.info(
        `💵 PRICE CHANGE: ${symbol} $${
          change.amount >= 0 ? "+" : ""
        }${change.amount.toFixed(2)} (${
          change.percent >= 0 ? "+" : ""
        }${change.percent.toFixed(2)}%)`
      );
    }

    logger.info(
      `🎯 DECISION: ${decision.decision} - ${decision.prediction.signal} (${decision.prediction.confidence}% confidence)`
    );

    if (decision.analytics?.detailedSkipAnalysis) {
      logger.info("\n" + decision.analytics.detailedSkipAnalysis);
    }

    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }
}
