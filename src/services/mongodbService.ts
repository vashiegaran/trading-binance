import { MongoClient, Db, Collection } from "mongodb";
import { logger } from "../utils/logger.js";
import { TradeRecord } from "../utils/profitTracker.js";
import { Prediction } from "../algorithms/predictionAlgorithm.js";
import { MarketData } from "./binanceService.js";

export interface SkipReason {
  reason: string;
  details: any;
  timestamp: Date;
}

export interface TradeDetails {
  signal: string;
  type: "BUY" | "SELL";
  confidence: number;
  quantity: number;
  price: number;
  amount: number;
  balanceBefore: { sol: number; usdt: number; totalValue: number };
  balanceAfter: { sol: number; usdt: number; totalValue: number };
  profit?: number;
  orderId?: string;
  fees?: { amount: number; currency: string };
  tradingPair: string;
}

export interface HourDecision {
  timestamp: Date;
  decision: "TRADED" | "SKIPPED";
  skipReasons?: SkipReason[];
  tradeDetails?: TradeDetails;
  prediction: Prediction;
  marketData: MarketData;
  balances: { sol: number; usdt: number; totalValue: number };
  executionTime?: number; // milliseconds
  errorDetails?: {
    message: string;
    stack?: string;
    timestamp: Date;
  };
}

export class MongoService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private isConnected: boolean = false;

  constructor() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      logger.warn("⚠️  MongoDB URI not configured. Analytics disabled.");
      return;
    }

    this.client = new MongoClient(mongoUri);
  }

  async connect(): Promise<void> {
    if (!this.client || this.isConnected) return;

    try {
      await this.client.connect();
      this.db = this.client.db(process.env.MONGODB_DB_NAME || "trading_bot");
      this.isConnected = true;

      // Create indexes for better query performance
      await this.createIndexes();

      logger.info("✅ Connected to MongoDB");
    } catch (error: any) {
      logger.error("MongoDB connection error:", error.message);
      this.isConnected = false;
      // Don't throw - allow bot to continue without MongoDB
    }
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) return;

    try {
      // Indexes for trades collection
      const tradesCollection = this.db.collection("trades");
      await tradesCollection.createIndex({ timestamp: -1 });
      await tradesCollection.createIndex({ type: 1 });
      await tradesCollection.createIndex({ symbol: 1 });
      await tradesCollection.createIndex({ timestamp: -1, type: 1 }); // Compound index

      // Indexes for bot_snapshots collection
      const snapshotsCollection = this.db.collection("bot_snapshots");
      await snapshotsCollection.createIndex({ timestamp: -1 });
      await snapshotsCollection.createIndex({ timestamp: -1, botStatus: 1 });

      // Indexes for hourly_metrics collection
      const metricsCollection = this.db.collection("hourly_metrics");
      await metricsCollection.createIndex({ hour: -1 });

      // Indexes for hour_decisions collection
      const decisionsCollection = this.db.collection("hour_decisions");
      await decisionsCollection.createIndex({ timestamp: -1 });
      await decisionsCollection.createIndex({ decision: 1 });
      await decisionsCollection.createIndex({ timestamp: -1, decision: 1 }); // Compound index

      // Indexes for startup_balances collection
      const startupBalancesCollection = this.db.collection("startup_balances");
      await startupBalancesCollection.createIndex({ timestamp: -1 });

      logger.info("✅ MongoDB indexes created");
    } catch (error: any) {
      logger.error("Error creating indexes:", error.message);
    }
  }

  async saveTrade(trade: TradeRecord): Promise<void> {
    if (!this.db || !this.isConnected) return;

    try {
      const trades = this.db.collection("trades");
      await trades.insertOne({
        ...trade,
        timestamp: new Date(trade.timestamp),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      logger.debug(`📊 Trade saved to MongoDB: ${trade.type} ${trade.symbol}`);
    } catch (error: any) {
      logger.error("Error saving trade to MongoDB:", error.message);
    }
  }

  async saveHourDecision(decision: HourDecision): Promise<void> {
    if (!this.db || !this.isConnected) return;

    try {
      const decisions = this.db.collection("hour_decisions");
      await decisions.insertOne({
        ...decision,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      if (decision.decision === "TRADED") {
        logger.debug(`✅ Hour decision logged: TRADED with full analytics`);
      } else {
        const reasonsCount = decision.skipReasons?.length || 0;
        logger.debug(
          `⏸️  Hour decision logged: SKIPPED with ${reasonsCount} reason(s)`
        );
      }
    } catch (error: any) {
      logger.error("Error saving hour decision to MongoDB:", error.message);
    }
  }

  async saveStartupBalance(data: {
    balances: { sol: number; usdt: number };
    totalValue: number;
    solPrice: number;
  }): Promise<void> {
    if (!this.db || !this.isConnected) return;

    try {
      const startupBalances = this.db.collection("startup_balances");

      // Check if there's already a startup balance recorded (in case of server restart)
      // We'll update it or insert new one
      const existing = await startupBalances.findOne(
        {},
        { sort: { timestamp: -1 } }
      );

      await startupBalances.insertOne({
        timestamp: new Date(),
        balances: {
          ...data.balances,
          totalValue: data.totalValue,
        },
        solPrice: data.solPrice,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      logger.debug(
        `💾 Startup balance saved: ${data.totalValue.toFixed(2)} USDT total`
      );
    } catch (error: any) {
      logger.error("Error saving startup balance:", error.message);
    }
  }

  async getStartupBalance(): Promise<{
    balances: { sol: number; usdt: number; totalValue: number };
    solPrice: number;
    timestamp: Date;
  } | null> {
    if (!this.db || !this.isConnected) return null;

    try {
      const startupBalances = this.db.collection("startup_balances");
      const latest = await startupBalances.findOne(
        {},
        { sort: { timestamp: 1 } } // Get the first/oldest startup balance
      );
      return latest
        ? {
            balances: latest.balances,
            solPrice: latest.solPrice,
            timestamp: latest.timestamp,
          }
        : null;
    } catch (error: any) {
      logger.error("Error getting startup balance:", error.message);
      return null;
    }
  }

  async saveBotSnapshot(data: {
    marketData: any;
    balances: { sol: number; usdt: number };
    prediction: any;
    botStatus: string;
  }): Promise<void> {
    if (!this.db || !this.isConnected) return;

    try {
      const snapshots = this.db.collection("bot_snapshots");
      const totalValue =
        data.balances.sol * data.marketData.price + data.balances.usdt;

      await snapshots.insertOne({
        timestamp: new Date(),
        marketData: data.marketData,
        balances: {
          ...data.balances,
          totalValue,
        },
        prediction: data.prediction,
        botStatus: data.botStatus,
        createdAt: new Date(),
      });
    } catch (error: any) {
      logger.error("Error saving bot snapshot:", error.message);
    }
  }

  async aggregateHourlyMetrics(): Promise<void> {
    if (!this.db || !this.isConnected) return;

    try {
      const db = this.db;
      const tradesCollection = db.collection("trades");
      const snapshotsCollection = db.collection("bot_snapshots");
      const metricsCollection = db.collection("hourly_metrics");

      // Get all hours from the last 24 hours that need aggregation
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Group trades by hour
      const hourlyTrades = await tradesCollection
        .aggregate([
          {
            $match: {
              timestamp: { $gte: yesterday },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d-%H:00:00",
                  date: "$timestamp",
                },
              },
              trades: { $push: "$$ROOT" },
              buyCount: {
                $sum: { $cond: [{ $eq: ["$type", "BUY"] }, 1, 0] },
              },
              sellCount: {
                $sum: { $cond: [{ $eq: ["$type", "SELL"] }, 1, 0] },
              },
              totalVolume: { $sum: "$amount" },
            },
          },
        ])
        .toArray();

      // Process each hour
      for (const hourData of hourlyTrades) {
        const hour = new Date(hourData._id);
        const trades = hourData.trades;

        const buyAmount = trades
          .filter((t: any) => t.type === "BUY")
          .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
        const sellAmount = trades
          .filter((t: any) => t.type === "SELL")
          .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
        const profit = sellAmount - buyAmount;
        const profitPercent = buyAmount > 0 ? (profit / buyAmount) * 100 : 0;

        // Get snapshot for this hour
        const snapshot = await snapshotsCollection.findOne({
          timestamp: {
            $gte: new Date(hour.getTime()),
            $lt: new Date(hour.getTime() + 60 * 60 * 1000),
          },
        });

        // Calculate cumulative profit up to this hour
        const previousMetrics = await metricsCollection.findOne(
          {},
          { sort: { hour: -1 } }
        );
        const cumulative = (previousMetrics?.profit?.cumulative || 0) + profit;

        // Upsert hourly metric
        await metricsCollection.updateOne(
          { hour },
          {
            $set: {
              hour,
              trades: {
                count: trades.length,
                buyCount: hourData.buyCount,
                sellCount: hourData.sellCount,
                volume: hourData.totalVolume,
              },
              profit: {
                amount: profit,
                percent: profitPercent,
                cumulative,
              },
              balances: snapshot?.balances || {
                sol: 0,
                usdt: 0,
                totalValue: 0,
              },
              marketPrice: snapshot?.marketData?.price || 0,
            },
          },
          { upsert: true }
        );
      }

      logger.debug("✅ Hourly metrics aggregated");
    } catch (error: any) {
      logger.error("Error aggregating hourly metrics:", error.message);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      logger.info("MongoDB connection closed");
    }
  }
}
