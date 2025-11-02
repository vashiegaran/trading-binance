import dotenv from 'dotenv';
import cron from 'node-cron';
import { TradingBot } from './bot/tradingBot.js';
import { logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

// Initialize the trading bot
const tradingBot = new TradingBot();

// Schedule cron job to run every hour at minute 0
// Cron format: minute hour day month weekday
// '0 * * * *' means: at minute 0 of every hour
const cronSchedule = '0 * * * *';

logger.info('🚀 Binance Solana Trading Bot Starting...');
logger.info(`⏰ Scheduled to run every hour (cron: ${cronSchedule})`);

// Run immediately on startup for testing, then schedule hourly
logger.info('Running initial check...');
tradingBot.execute().catch((error) => {
  logger.error('Initial execution error:', error);
});

// Schedule the bot to run every hour
cron.schedule(cronSchedule, async () => {
  logger.info('⏰ Hourly cron job triggered');
  try {
    await tradingBot.execute();
  } catch (error) {
    logger.error('Cron job execution error:', error);
  }
});

// Keep the process running
logger.info('✅ Bot is running. Press Ctrl+C to stop.');

