import { logger } from "../utils/logger.js";
import { BinanceService } from "../services/binanceService.js";
import { PredictionAlgorithm } from "../algorithms/predictionAlgorithm.js";
import { TradingStrategy } from "../strategies/tradingStrategy.js";
import { ProfitTracker } from "../utils/profitTracker.js";
import { MongoService } from "../services/mongodbService.js";

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

    try {
      // Step 1: Fetch current market data
      logger.info("📊 Fetching market data for SOL/USDT...");
      const marketData = await this.binanceService.getMarketData("SOLUSDT");

      // Step 2: Analyze and predict
      logger.info("🔮 Running prediction algorithm...");
      const prediction = await this.predictionAlgorithm.predict(marketData);

      // Step 3: Execute trading strategy
      logger.info("💼 Executing trading strategy...");
      await this.tradingStrategy.execute(prediction, marketData);

      // Step 4: Show profit summary
      const solBalance = await this.binanceService.getBalance("SOL");
      const usdtBalance = await this.binanceService.getBalance("USDT");
      this.profitTracker.logSummary(
        { sol: solBalance, usdt: usdtBalance },
        marketData.price
      );

      // Step 5: Save bot snapshot to MongoDB
      await this.mongoService.saveBotSnapshot({
        marketData,
        balances: { sol: solBalance, usdt: usdtBalance },
        prediction,
        botStatus: "running",
      });

      logger.info("✅ Trading cycle completed successfully");
      logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    } catch (error) {
      logger.error("❌ Error in trading cycle:", error);
      throw error;
    }
  }
}
