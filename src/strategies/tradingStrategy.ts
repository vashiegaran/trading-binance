import { BinanceService } from '../services/binanceService.js';
import { Prediction } from '../algorithms/predictionAlgorithm.js';
import { MarketData } from '../services/binanceService.js';
import { logger } from '../utils/logger.js';
import { ProfitTracker } from '../utils/profitTracker.js';

export class TradingStrategy {
  private binanceService: BinanceService;
  private profitTracker: ProfitTracker;
  private readonly TRADING_PAIR = 'SOLUSDT';
  private readonly BASE_ASSET = 'SOL';
  private readonly QUOTE_ASSET = 'USDT';
  private readonly MIN_CONFIDENCE = parseInt(process.env.MIN_CONFIDENCE || '50', 10);
  private readonly TRADE_AMOUNT_USDT = parseFloat(process.env.TRADE_AMOUNT_USDT || '100');

  constructor(binanceService: BinanceService) {
    this.binanceService = binanceService;
    this.profitTracker = new ProfitTracker();
  }

  /**
   * Execute trading strategy based on prediction
   */
  async execute(prediction: Prediction, marketData: MarketData): Promise<void> {
    // Check if prediction confidence is high enough
    if (prediction.confidence < this.MIN_CONFIDENCE) {
      logger.info(`⏸️  Confidence too low (${prediction.confidence}% < ${this.MIN_CONFIDENCE}%), skipping trade`);
      return;
    }

    // Check if we should trade based on signal
    if (prediction.signal === 'HOLD') {
      logger.info('⏸️  Signal is HOLD, no action taken');
      return;
    }

    // Get current balances
    const solBalance = await this.binanceService.getBalance(this.BASE_ASSET);
    const usdtBalance = await this.binanceService.getBalance(this.QUOTE_ASSET);

    // Set initial balance on first run
    await this.profitTracker.setInitialBalance(solBalance, usdtBalance);

    logger.info(`💰 Current Balances: ${solBalance.toFixed(4)} ${this.BASE_ASSET} | ${usdtBalance.toFixed(2)} ${this.QUOTE_ASSET}`);

    // Execute based on signal
    if (prediction.signal === 'BUY') {
      await this.executeBuy(usdtBalance, marketData.price, solBalance);
    } else if (prediction.signal === 'SELL') {
      await this.executeSell(solBalance, marketData.price, usdtBalance);
    }
  }

  /**
   * Execute buy strategy
   */
  private async executeBuy(usdtBalance: number, currentPrice: number, solBalanceBefore: number): Promise<void> {
    // Check if we have enough USDT
    const tradeAmount = Math.min(this.TRADE_AMOUNT_USDT, usdtBalance * 0.95); // Use 95% to account for fees

    if (tradeAmount < 10) {
      logger.warn(`⚠️  Insufficient USDT balance (${usdtBalance.toFixed(2)}), cannot buy`);
      return;
    }

    // Calculate quantity to buy
    const quantity = tradeAmount / currentPrice;

    logger.info(`🟢 BUY Strategy: Using ${tradeAmount.toFixed(2)} USDT to buy ~${quantity.toFixed(4)} ${this.BASE_ASSET}`);

    const balanceBefore = {
      sol: solBalanceBefore,
      usdt: usdtBalance,
    };

    try {
      // Option 1: Market Buy (immediate execution)
      if (process.env.USE_MARKET_ORDERS === 'true') {
        await this.binanceService.buyMarket(this.TRADING_PAIR, quantity);
      } 
      // Option 2: Limit Buy (set below current price)
      else {
        const limitPrice = currentPrice * 0.995; // 0.5% below market price
        await this.binanceService.buyLimit(this.TRADING_PAIR, quantity, limitPrice);
      }

      // Get balances after trade
      const solBalanceAfter = await this.binanceService.getBalance(this.BASE_ASSET);
      const usdtBalanceAfter = await this.binanceService.getBalance(this.QUOTE_ASSET);

      const balanceAfter = {
        sol: solBalanceAfter,
        usdt: usdtBalanceAfter,
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
    } catch (error: any) {
      logger.error(`❌ Buy execution failed:`, error.message);
    }
  }

  /**
   * Execute sell strategy
   */
  private async executeSell(solBalance: number, currentPrice: number, usdtBalanceBefore: number): Promise<void> {
    // Check if we have enough SOL to sell
    const minTradeAmount = 0.01; // Minimum SOL trade amount
    const tradeQuantity = Math.min(solBalance * 0.95, solBalance); // Use 95% to account for fees

    if (tradeQuantity < minTradeAmount) {
      logger.warn(`⚠️  Insufficient ${this.BASE_ASSET} balance (${solBalance.toFixed(4)}), cannot sell`);
      return;
    }

    logger.info(`🔴 SELL Strategy: Selling ${tradeQuantity.toFixed(4)} ${this.BASE_ASSET}`);

    const balanceBefore = {
      sol: solBalance,
      usdt: usdtBalanceBefore,
    };

    // Calculate expected sell amount (approximate)
    const expectedAmount = tradeQuantity * currentPrice;

    try {
      // Option 1: Market Sell (immediate execution)
      if (process.env.USE_MARKET_ORDERS === 'true') {
        await this.binanceService.sellMarket(this.TRADING_PAIR, tradeQuantity);
      }
      // Option 2: Limit Sell (set above current price)
      else {
        const limitPrice = currentPrice * 1.005; // 0.5% above market price
        await this.binanceService.sellLimit(this.TRADING_PAIR, tradeQuantity, limitPrice);
      }

      // Get balances after trade
      const solBalanceAfter = await this.binanceService.getBalance(this.BASE_ASSET);
      const usdtBalanceAfter = await this.binanceService.getBalance(this.QUOTE_ASSET);

      const balanceAfter = {
        sol: solBalanceAfter,
        usdt: usdtBalanceAfter,
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
    } catch (error: any) {
      logger.error(`❌ Sell execution failed:`, error.message);
    }
  }
}

