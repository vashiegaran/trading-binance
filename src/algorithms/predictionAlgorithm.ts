import { MarketData } from "../services/binanceService.js";
import { logger } from "../utils/logger.js";

export interface Prediction {
  signal: "BUY" | "SELL" | "HOLD";
  confidence: number; // 0-100
  predictedPrice: number;
  reasoning: string[];
  indicators: {
    rsi?: number;
    movingAverage?: number;
    priceMomentum?: number;
    volumeTrend?: "increasing" | "decreasing" | "stable";
  };
}

export class PredictionAlgorithm {
  /**
   * Main prediction function that combines multiple indicators
   */
  async predict(marketData: MarketData): Promise<Prediction> {
    const indicators = this.calculateIndicators(marketData);
    const reasoning: string[] = [];

    // Calculate signals based on indicators
    let buyScore = 0;
    let sellScore = 0;

    // RSI Analysis (Relative Strength Index)
    if (indicators.rsi) {
      if (indicators.rsi < 30) {
        buyScore += 30;
        reasoning.push(
          `RSI is oversold (${indicators.rsi.toFixed(2)}), potential buy signal`
        );
      } else if (indicators.rsi > 70) {
        sellScore += 30;
        reasoning.push(
          `RSI is overbought (${indicators.rsi.toFixed(
            2
          )}), potential sell signal`
        );
      }
    }

    // Moving Average Analysis
    if (indicators.movingAverage) {
      const priceVsMA = marketData.price / indicators.movingAverage;
      if (priceVsMA < 0.98) {
        buyScore += 25;
        reasoning.push(
          `Price below moving average, potential buying opportunity`
        );
      } else if (priceVsMA > 1.02) {
        sellScore += 25;
        reasoning.push(
          `Price above moving average, potential selling opportunity`
        );
      }
    }

    // Price Momentum Analysis
    if (indicators.priceMomentum) {
      if (indicators.priceMomentum > 2) {
        buyScore += 20;
        reasoning.push(`Strong positive momentum detected`);
      } else if (indicators.priceMomentum < -2) {
        sellScore += 20;
        reasoning.push(`Strong negative momentum detected`);
      }
    }

    // Volume Trend Analysis
    if (indicators.volumeTrend === "increasing") {
      buyScore += 15;
      reasoning.push(`Increasing volume suggests market interest`);
    } else if (indicators.volumeTrend === "decreasing") {
      sellScore += 10;
      reasoning.push(`Decreasing volume suggests weakening trend`);
    }

    // 24h Price Change Analysis
    if (marketData.priceChangePercent24h > 5) {
      sellScore += 10;
      reasoning.push(
        `Strong 24h gain (${marketData.priceChangePercent24h.toFixed(
          2
        )}%), consider profit-taking`
      );
    } else if (marketData.priceChangePercent24h < -5) {
      buyScore += 10;
      reasoning.push(
        `Significant 24h decline (${marketData.priceChangePercent24h.toFixed(
          2
        )}%), potential buying opportunity`
      );
    }

    // Determine signal
    const confidence = Math.abs(buyScore - sellScore);
    let signal: "BUY" | "SELL" | "HOLD";

    if (confidence < 20) {
      signal = "HOLD";
      reasoning.push("Indicators are mixed, holding position");
    } else if (buyScore > sellScore) {
      signal = "BUY";
    } else {
      signal = "SELL";
    }

    // Simple price prediction based on trend
    const predictedPrice = this.predictPrice(marketData, indicators);

    const prediction: Prediction = {
      signal,
      confidence: Math.min(confidence, 100),
      predictedPrice,
      reasoning,
      indicators,
    };

    logger.info(`🔮 Prediction: ${signal} (Confidence: ${confidence}%)`);
    logger.info(`   Reasoning: ${reasoning.join("; ")}`);

    return prediction;
  }

  /**
   * Calculate technical indicators
   */
  private calculateIndicators(marketData: MarketData) {
    const indicators: Prediction["indicators"] = {};

    if (marketData.klineData && marketData.klineData.length > 0) {
      // Calculate RSI (simplified version)
      indicators.rsi = this.calculateRSI(marketData.klineData);

      // Calculate Simple Moving Average (50-period)
      indicators.movingAverage = this.calculateSMA(marketData.klineData, 50);

      // Calculate price momentum
      indicators.priceMomentum = this.calculateMomentum(marketData.klineData);

      // Analyze volume trend
      indicators.volumeTrend = this.analyzeVolumeTrend(marketData.klineData);
    }

    return indicators;
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  private calculateRSI(klines: any[], period: number = 14): number {
    if (klines.length < period + 1) return 50; // Default neutral

    const closes = klines.map((k) => parseFloat(k.close));
    let gains = 0;
    let losses = 0;

    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    return rsi;
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(klines: any[], period: number): number {
    if (klines.length < period) {
      return parseFloat(klines[klines.length - 1].close);
    }

    const recent = klines.slice(-period);
    const sum = recent.reduce((acc, k) => acc + parseFloat(k.close), 0);
    return sum / period;
  }

  /**
   * Calculate price momentum
   */
  private calculateMomentum(klines: any[]): number {
    if (klines.length < 10) return 0;

    const recent = klines.slice(-10);
    const first = parseFloat(recent[0].close);
    const last = parseFloat(recent[recent.length - 1].close);

    return ((last - first) / first) * 100;
  }

  /**
   * Analyze volume trend
   */
  private analyzeVolumeTrend(
    klines: any[]
  ): "increasing" | "decreasing" | "stable" {
    if (klines.length < 5) return "stable";

    const recent = klines.slice(-5);
    const volumes = recent.map((k) => parseFloat(k.volume));

    const firstHalf = volumes.slice(0, Math.floor(volumes.length / 2));
    const secondHalf = volumes.slice(Math.floor(volumes.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (change > 10) return "increasing";
    if (change < -10) return "decreasing";
    return "stable";
  }

  /**
   * Predict future price (simplified linear regression)
   */
  private predictPrice(marketData: MarketData, indicators: any): number {
    const currentPrice = marketData.price;

    // Simple prediction based on momentum
    if (indicators.priceMomentum) {
      const predictedChange = indicators.priceMomentum * 0.5; // Conservative estimate
      return currentPrice * (1 + predictedChange / 100);
    }

    return currentPrice;
  }
}
