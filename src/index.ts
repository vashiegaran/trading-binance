import dotenv from "dotenv";
import cron from "node-cron";
import { TradingBot } from "./bot/tradingBot.js";
import { logger } from "./utils/logger.js";
import { startHealthCheckServer } from "./health.js";
import { BinanceService } from "./services/binanceService.js";
import { MongoService } from "./services/mongodbService.js";

// Load environment variables
dotenv.config();

// Start health check server (for Fly.io)
startHealthCheckServer();

// Log and record total portfolio balance on startup
async function logAndRecordStartupBalance() {
  try {
    const binanceService = new BinanceService();
    const mongoService = new MongoService();

    // Connect to MongoDB if not already connected
    await mongoService.connect();

    // Get balances
    const usdtBalance = await binanceService.getBalance("USDT");
    const solBalance = await binanceService.getBalance("SOL");

    // Get current SOL price to calculate total portfolio value
    const marketData = await binanceService.getMarketData("SOLUSDT");
    const solPrice = marketData.price;

    // Calculate total portfolio value
    const totalValue = solBalance * solPrice + usdtBalance;

    // Log balances
    logger.info(`💰 Starting Balances:`);
    logger.info(`   USDT: ${usdtBalance.toFixed(2)} USDT`);
    logger.info(
      `   SOL: ${solBalance.toFixed(4)} SOL ($${(solBalance * solPrice).toFixed(
        2
      )})`
    );
    logger.info(`   Total Portfolio Value: $${totalValue.toFixed(2)} USDT`);

    // Save to MongoDB for analytics
    await mongoService.saveStartupBalance({
      balances: {
        sol: solBalance,
        usdt: usdtBalance,
      },
      totalValue: totalValue,
      solPrice: solPrice,
    });

    logger.info(`💾 Startup balance recorded in MongoDB for analytics`);
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`⚠️  Could not fetch/record startup balance: ${errorMessage}`);
  }
}

// Initialize the trading bot
const tradingBot = new TradingBot();

// Schedule cron job to run every 15 minutes
// Cron format: minute hour day month weekday
// '*/15 * * * *' means: every 15 minutes
const cronSchedule = "*/15 * * * *";

logger.info("🚀 Binance Solana Trading Bot Starting...");
logger.info(`⏰ Scheduled to run every 15 minutes (cron: ${cronSchedule})`);

// Log and record total portfolio balance on startup
logAndRecordStartupBalance().catch((error) => {
  logger.warn(`⚠️  Failed to log/record startup balance: ${error.message}`);
});

// Run immediately on startup for testing, then schedule every 15 minutes
logger.info("Running initial check...");
tradingBot.execute().catch((error) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  logger.error("Initial execution error:", errorMessage);
  if (errorStack) {
    logger.error("Stack trace:", errorStack);
  }
});

// Schedule the bot to run every 15 minutes
cron.schedule(cronSchedule, async () => {
  logger.info("⏰ 15-minute cron job triggered");
  try {
    await tradingBot.execute();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error("Cron job execution error:", errorMessage);
    if (errorStack) {
      logger.error("Stack trace:", errorStack);
    }
  }
});

// Keep the process running
logger.info("✅ Bot is running. Press Ctrl+C to stop.");
