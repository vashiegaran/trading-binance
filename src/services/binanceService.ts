import { Spot } from "@binance/connector";
import { logger } from "../utils/logger.js";

export interface MarketData {
  symbol: string;
  price: number;
  volume24h: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
  klineData?: any[];
}

export class BinanceService {
  private client: Spot;

  constructor() {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;

    if (!apiKey || !apiSecret) {
      logger.warn(
        "⚠️  Binance API credentials not found. Using public client (read-only)."
      );
      this.client = new Spot();
    } else {
      this.client = new Spot(apiKey, apiSecret);
      logger.info("✅ Binance API client initialized with credentials");
    }
  }

  /**
   * Get current market data for a trading pair
   */
  async getMarketData(symbol: string): Promise<MarketData> {
    try {
      // Get 24hr ticker statistics
      // ticker24hr(symbol, symbols, type, options)
      const tickerResponse = await this.client.ticker24hr(symbol.toUpperCase());
      const ticker = Array.isArray(tickerResponse.data)
        ? tickerResponse.data[0]
        : tickerResponse.data;

      // Get current price
      // tickerPrice(symbol, symbols, options)
      const priceResponse = await this.client.tickerPrice(symbol.toUpperCase());
      const priceData = Array.isArray(priceResponse.data)
        ? priceResponse.data[0]
        : priceResponse.data;
      const currentPrice = parseFloat(priceData?.price || "0");

      // Get historical kline data (candlestick data) for analysis
      const klinesResponse = await this.client.klines(symbol, "1h", {
        limit: 100,
      });
      const klines = Array.isArray(klinesResponse.data)
        ? klinesResponse.data
        : [];

      // Format kline data to match expected structure (array format: [openTime, open, high, low, close, volume, ...])
      const formattedKlines = klines.map((k: any[]) => ({
        openTime: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        closeTime: k[6],
      }));

      const marketData: MarketData = {
        symbol,
        price: currentPrice,
        volume24h: parseFloat(ticker.quoteVolume || "0"),
        priceChange24h: parseFloat(ticker.priceChange || "0"),
        priceChangePercent24h: parseFloat(ticker.priceChangePercent || "0"),
        high24h: parseFloat(ticker.highPrice || "0"),
        low24h: parseFloat(ticker.lowPrice || "0"),
        timestamp: Date.now(),
        klineData: formattedKlines,
      };

      logger.info(
        `📈 ${symbol} Price: $${currentPrice.toFixed(
          4
        )} | 24h Change: ${marketData.priceChangePercent24h.toFixed(2)}%`
      );

      return marketData;
    } catch (error: any) {
      logger.error(`Error fetching market data for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get account balance for a specific asset
   */
  async getBalance(asset: string): Promise<number> {
    try {
      const response = await this.client.account();
      const account = response.data;
      const balance = account.balances.find((b: any) => b.asset === asset);
      return balance ? parseFloat(balance.free) : 0;
    } catch (error: any) {
      logger.error(`Error fetching balance for ${asset}:`, error.message);
      throw error;
    }
  }

  /**
   * Place a market buy order
   */
  async buyMarket(symbol: string, quantity: number): Promise<any> {
    try {
      logger.info(`🟢 Placing MARKET BUY order: ${quantity} ${symbol}`);
      const response = await this.client.newOrder(symbol, "BUY", "MARKET", {
        quantity: quantity.toString(),
      });
      const order = response.data;
      logger.info(`✅ Buy order placed: ${JSON.stringify(order)}`);
      return order;
    } catch (error: any) {
      logger.error(`Error placing buy order:`, error.message);
      throw error;
    }
  }

  /**
   * Place a market sell order
   */
  async sellMarket(symbol: string, quantity: number): Promise<any> {
    try {
      logger.info(`🔴 Placing MARKET SELL order: ${quantity} ${symbol}`);
      const response = await this.client.newOrder(symbol, "SELL", "MARKET", {
        quantity: quantity.toString(),
      });
      const order = response.data;
      logger.info(`✅ Sell order placed: ${JSON.stringify(order)}`);
      return order;
    } catch (error: any) {
      logger.error(`Error placing sell order:`, error.message);
      throw error;
    }
  }

  /**
   * Place a limit buy order
   */
  async buyLimit(
    symbol: string,
    quantity: number,
    price: number
  ): Promise<any> {
    try {
      logger.info(
        `🟢 Placing LIMIT BUY order: ${quantity} ${symbol} @ $${price}`
      );
      const response = await this.client.newOrder(symbol, "BUY", "LIMIT", {
        price: price.toString(),
        quantity: quantity.toString(),
        timeInForce: "GTC", // Good Till Cancel
      });
      const order = response.data;
      logger.info(`✅ Limit buy order placed: ${JSON.stringify(order)}`);
      return order;
    } catch (error: any) {
      logger.error(`Error placing limit buy order:`, error.message);
      throw error;
    }
  }

  /**
   * Place a limit sell order
   */
  async sellLimit(
    symbol: string,
    quantity: number,
    price: number
  ): Promise<any> {
    try {
      logger.info(
        `🔴 Placing LIMIT SELL order: ${quantity} ${symbol} @ $${price}`
      );
      const response = await this.client.newOrder(symbol, "SELL", "LIMIT", {
        price: price.toString(),
        quantity: quantity.toString(),
        timeInForce: "GTC",
      });
      const order = response.data;
      logger.info(`✅ Limit sell order placed: ${JSON.stringify(order)}`);
      return order;
    } catch (error: any) {
      logger.error(`Error placing limit sell order:`, error.message);
      throw error;
    }
  }
}
