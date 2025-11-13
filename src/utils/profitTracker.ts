import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { logger } from './logger.js';
import { MongoService } from '../services/mongodbService.js';

export interface TradeRecord {
  timestamp: string;
  type: 'BUY' | 'SELL';
  symbol: string;
  quantity: number;
  price: number;
  amount: number;
  balanceBefore: { sol: number; usdt: number };
  balanceAfter: { sol: number; usdt: number };
}

export interface ProfitSummary {
  totalTrades: number;
  buyTrades: number;
  sellTrades: number;
  totalInvested: number;
  totalReturned: number;
  totalProfit: number;
  totalProfitPercent: number;
  currentHoldings: { sol: number; usdt: number };
  currentHoldingsValue: number;
  overallProfit: number;
  overallProfitPercent: number;
}

export class ProfitTracker {
  private readonly TRACKING_FILE = path.join(process.cwd(), 'logs', 'trades.json');
  private readonly SUMMARY_FILE = path.join(process.cwd(), 'logs', 'profit_summary.json');
  private trades: TradeRecord[] = [];
  private initialBalance: { sol: number; usdt: number } | null = null;
  private mongoService: MongoService;
  private tradesLoaded: boolean = false;

  constructor() {
    this.mongoService = new MongoService();
    // Note: loadTrades is async but constructor can't be async
    // We'll load trades synchronously from file system if possible, or ensure it's awaited before use
    this.loadTradesSync();
  }

  /**
   * Load trades synchronously (for immediate use in constructor)
   * This ensures trades are available immediately, though async loading is preferred
   */
  private loadTradesSync(): void {
    try {
      // Use synchronous file read for immediate availability
      const data = fsSync.readFileSync(this.TRACKING_FILE, 'utf-8');
      this.trades = JSON.parse(data);
      this.tradesLoaded = true;
      logger.info(`📁 Loaded ${this.trades.length} previous trades (sync)`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, start fresh
        this.trades = [];
        this.tradesLoaded = true;
      } else {
        logger.warn('Error loading trades synchronously, will retry async:', error.message);
        // Fallback to async loading
        this.loadTrades();
      }
    }
  }

  /**
   * Set initial balance (should be called on first run)
   */
  async setInitialBalance(sol: number, usdt: number): Promise<void> {
    if (this.initialBalance === null) {
      this.initialBalance = { sol, usdt };
      logger.info(`📊 Initial Balance Set: ${sol.toFixed(4)} SOL | ${usdt.toFixed(2)} USDT`);
    }
  }

  /**
   * Record a BUY trade
   */
  async recordBuy(
    symbol: string,
    quantity: number,
    price: number,
    amount: number,
    balanceBefore: { sol: number; usdt: number },
    balanceAfter: { sol: number; usdt: number }
  ): Promise<void> {
    const trade: TradeRecord = {
      timestamp: new Date().toISOString(),
      type: 'BUY',
      symbol,
      quantity,
      price,
      amount,
      balanceBefore,
      balanceAfter,
    };

    this.trades.push(trade);
    await this.saveTrades();

    // Also save to MongoDB
    await this.mongoService.saveTrade(trade);

    logger.info(
      `💰 BUY Recorded: ${quantity.toFixed(4)} ${symbol} @ $${price.toFixed(4)} = $${amount.toFixed(2)}`
    );
    this.logSummary();
  }

  /**
   * Record a SELL trade
   */
  async recordSell(
    symbol: string,
    quantity: number,
    price: number,
    amount: number,
    balanceBefore: { sol: number; usdt: number },
    balanceAfter: { sol: number; usdt: number }
  ): Promise<void> {
    const trade: TradeRecord = {
      timestamp: new Date().toISOString(),
      type: 'SELL',
      symbol,
      quantity,
      price,
      amount,
      balanceBefore,
      balanceAfter,
    };

    this.trades.push(trade);
    await this.saveTrades();

    // Also save to MongoDB
    await this.mongoService.saveTrade(trade);

    // Calculate profit for this sell
    const profit = this.calculateSellProfit(trade);
    
    logger.info(
      `💰 SELL Recorded: ${quantity.toFixed(4)} ${symbol} @ $${price.toFixed(4)} = $${amount.toFixed(2)}`
    );

    if (profit !== null) {
      const profitPercent = ((profit.netProfit / profit.buyAmount) * 100).toFixed(2);
      if (profit.netProfit > 0) {
        logger.info(`✅ PROFIT: +$${profit.netProfit.toFixed(2)} (+${profitPercent}%)`);
      } else {
        logger.info(`❌ LOSS: $${profit.netProfit.toFixed(2)} (${profitPercent}%)`);
      }
    }

    this.logSummary();
  }

  /**
   * Calculate profit for a sell trade by matching it with the corresponding buy
   */
  private calculateSellProfit(sellTrade: TradeRecord): {
    buyAmount: number;
    sellAmount: number;
    netProfit: number;
    buyPrice: number;
    sellPrice: number;
    quantity: number;
  } | null {
    // Find the most recent unmatched BUY trade
    const unmatchedBuys = this.trades.filter(
      (t) => t.type === 'BUY' && new Date(t.timestamp) < new Date(sellTrade.timestamp)
    );

    if (unmatchedBuys.length === 0) return null;

    // Use FIFO (First In First Out) - match with oldest buy
    const buyTrade = unmatchedBuys[0];
    
    const buyAmount = buyTrade.amount;
    const sellAmount = sellTrade.amount;
    const netProfit = sellAmount - buyAmount;

    return {
      buyAmount,
      sellAmount,
      netProfit,
      buyPrice: buyTrade.price,
      sellPrice: sellTrade.price,
      quantity: sellTrade.quantity,
    };
  }

  /**
   * Get profit summary
   */
  getSummary(currentBalance: { sol: number; usdt: number }, currentPrice: number): ProfitSummary {
    // Ensure trades are loaded (safety check)
    if (!this.tradesLoaded && this.trades.length === 0) {
      this.loadTradesSync();
    }
    
    const buyTrades = this.trades.filter((t) => t.type === 'BUY');
    const sellTrades = this.trades.filter((t) => t.type === 'SELL');

    const totalInvested = buyTrades.reduce((sum, t) => sum + t.amount, 0);
    const totalReturned = sellTrades.reduce((sum, t) => sum + t.amount, 0);

    // Calculate profit from closed trades (matched buy/sell pairs)
    const closedProfit = this.calculateClosedProfit();
    
    // Current holdings value
    const currentHoldingsValue = currentBalance.sol * currentPrice;

    // Overall profit = closed profit + unrealized profit (current holdings)
    const overallProfit = closedProfit.netProfit + (currentHoldingsValue - closedProfit.unmatchedBuys);
    const overallProfitPercent = this.initialBalance
      ? ((overallProfit / (this.initialBalance.usdt)) * 100)
      : 0;

    return {
      totalTrades: this.trades.length,
      buyTrades: buyTrades.length,
      sellTrades: sellTrades.length,
      totalInvested,
      totalReturned,
      totalProfit: closedProfit.netProfit,
      totalProfitPercent: totalInvested > 0 ? (closedProfit.netProfit / totalInvested) * 100 : 0,
      currentHoldings: currentBalance,
      currentHoldingsValue,
      overallProfit,
      overallProfitPercent,
    };
  }

  /**
   * Calculate profit from closed positions (matched buy/sell pairs)
   */
  private calculateClosedProfit(): {
    netProfit: number;
    unmatchedBuys: number;
  } {
    const buys: TradeRecord[] = [];
    let netProfit = 0;
    let totalUnmatchedBuys = 0;

    for (const trade of this.trades) {
      if (trade.type === 'BUY') {
        buys.push(trade);
      } else if (trade.type === 'SELL') {
        if (buys.length > 0) {
          const buy = buys.shift()!; // FIFO - take oldest buy
          const profit = trade.amount - buy.amount;
          netProfit += profit;
        }
      }
    }

    // Sum remaining unmatched buys
    totalUnmatchedBuys = buys.reduce((sum, b) => sum + b.amount, 0);

    return { netProfit, unmatchedBuys: totalUnmatchedBuys };
  }

  /**
   * Log profit summary to console
   */
  logSummary(currentBalance?: { sol: number; usdt: number }, currentPrice?: number): void {
    if (this.trades.length === 0) {
      logger.info('📊 No trades recorded yet');
      return;
    }

    const balance = currentBalance || this.trades[this.trades.length - 1].balanceAfter;
    const price = currentPrice || this.trades[this.trades.length - 1].price;
    const summary = this.getSummary(balance, price);

    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('📊 PROFIT & LOSS SUMMARY');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info(`Total Trades: ${summary.totalTrades} (${summary.buyTrades} buys, ${summary.sellTrades} sells)`);
    logger.info(`Total Invested: $${summary.totalInvested.toFixed(2)}`);
    logger.info(`Total Returned: $${summary.totalReturned.toFixed(2)}`);
    
    if (summary.totalProfit >= 0) {
      logger.info(`✅ Closed Profit: +$${summary.totalProfit.toFixed(2)} (+${summary.totalProfitPercent.toFixed(2)}%)`);
    } else {
      logger.info(`❌ Closed Loss: $${summary.totalProfit.toFixed(2)} (${summary.totalProfitPercent.toFixed(2)}%)`);
    }
    
    logger.info(`Current Holdings: ${summary.currentHoldings.sol.toFixed(4)} SOL | ${summary.currentHoldings.usdt.toFixed(2)} USDT`);
    logger.info(`Current Holdings Value: $${summary.currentHoldingsValue.toFixed(2)}`);
    
    if (summary.overallProfit >= 0) {
      logger.info(`✅ Overall Profit: +$${summary.overallProfit.toFixed(2)} (+${summary.overallProfitPercent.toFixed(2)}%)`);
    } else {
      logger.info(`❌ Overall Loss: $${summary.overallProfit.toFixed(2)} (${summary.overallProfitPercent.toFixed(2)}%)`);
    }
    
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * Load trades from file (async version - called as fallback or for refresh)
   */
  private async loadTrades(): Promise<void> {
    try {
      const data = await fs.readFile(this.TRACKING_FILE, 'utf-8');
      this.trades = JSON.parse(data);
      this.tradesLoaded = true;
      logger.info(`📁 Loaded ${this.trades.length} previous trades (async)`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, start fresh
        this.trades = [];
        this.tradesLoaded = true;
      } else {
        logger.error('Error loading trades:', error.message);
      }
    }
  }

  /**
   * Ensure trades are loaded before use (for async safety)
   */
  private async ensureTradesLoaded(): Promise<void> {
    if (!this.tradesLoaded) {
      await this.loadTrades();
    }
  }

  /**
   * Save trades to file
   */
  private async saveTrades(): Promise<void> {
    try {
      await fs.writeFile(this.TRACKING_FILE, JSON.stringify(this.trades, null, 2));
      
      // Also save summary
      const currentBalance = this.trades.length > 0 
        ? this.trades[this.trades.length - 1].balanceAfter 
        : { sol: 0, usdt: 0 };
      const lastPrice = this.trades.length > 0 
        ? this.trades[this.trades.length - 1].price 
        : 0;
      const summary = this.getSummary(currentBalance, lastPrice);
      
      await fs.writeFile(this.SUMMARY_FILE, JSON.stringify(summary, null, 2));
    } catch (error: any) {
      logger.error('Error saving trades:', error.message);
    }
  }

  /**
   * Get all trades (for risk management calculations)
   */
  getTrades(): TradeRecord[] {
    // Ensure trades are loaded (safety check)
    if (!this.tradesLoaded && this.trades.length === 0) {
      this.loadTradesSync();
    }
    return [...this.trades];
  }

  /**
   * Calculate average entry price for unmatched SOL holdings
   */
  getAverageEntryPrice(): number {
    // Ensure trades are loaded (safety check)
    if (!this.tradesLoaded && this.trades.length === 0) {
      this.loadTradesSync();
    }
    
    const buyTrades = this.trades.filter((t) => t.type === 'BUY');
    const sellTrades = this.trades.filter((t) => t.type === 'SELL');

    // Calculate unmatched buys (FIFO matching)
    const unmatchedBuys: TradeRecord[] = [];
    const sells = [...sellTrades];
    for (const buy of buyTrades) {
      if (sells.length > 0) {
        sells.shift(); // Match first sell with first buy
      } else {
        unmatchedBuys.push(buy);
      }
    }

    if (unmatchedBuys.length === 0) {
      return 0;
    }

    // Calculate weighted average entry price
    let totalCost = 0;
    let totalQuantity = 0;
    for (const buy of unmatchedBuys) {
      totalCost += buy.amount;
      totalQuantity += buy.quantity;
    }

    return totalQuantity > 0 ? totalCost / totalQuantity : 0;
  }
}

