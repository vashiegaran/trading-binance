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
    // Connect to MongoDB
    this.mongoService
      .connect()
      .catch((err) => logger.error("MongoDB connection failed:", err));
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

      // Step 5: Save hour decision with full analytics to MongoDB
      const executionTime = Date.now() - cycleStartTime;

      const hourDecision: HourDecision = {
        timestamp: new Date(),
        decision: strategyResult.traded ? "TRADED" : "SKIPPED",
        skipReasons: strategyResult.skipReasons,
        tradeDetails: strategyResult.tradeDetails,
        prediction: prediction,
        marketData: marketData,
        balances: {
          sol: solBalance,
          usdt: usdtBalance,
          totalValue: totalValue,
        },
        executionTime: executionTime,
      };

      await this.mongoService.saveHourDecision(hourDecision);

      // Step 6: Save bot snapshot to MongoDB
      await this.mongoService.saveBotSnapshot({
        marketData,
        balances: { sol: solBalance, usdt: usdtBalance },
        prediction,
        botStatus: "running",
      });

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
      } catch (innerError) {
        // Ignore errors when saving error details
      }

      logger.error("❌ Error in trading cycle:", error);
      throw error;
    }
  }
}
