import { MarketData } from "../services/binanceService.js";
import { logger } from "../utils/logger.js";

export interface Prediction {
  signal: "BUY" | "SELL" | "HOLD";
  confidence: number; // 0-100
  predictedPrice: number;
  reasoning: string[];
  indicators: {
    rsi?: number;
    sma20?: number;
    sma50?: number;
    ema12?: number;
    ema26?: number;
    macd?: {
      macd: number;
      signal: number;
      histogram: number;
    };
    bollinger?: {
      upper: number;
      middle: number;
      lower: number;
      bandWidth: number;
      position: number; // -1 to 1, where -1 is lower band, 1 is upper band
    };
    momentum?: {
      momentum: number;
      momentumRate: number;
      volatility: number;
    };
    atr?: number;
    volumeTrend?: "increasing" | "decreasing" | "stable";
    marketRegime?: "bull" | "bear" | "sideways";
  };
  riskReward?: {
    riskReward: number;
    suggestedStopLoss: number;
    suggestedTakeProfit: number;
  };
}

export class PredictionAlgorithm {
  /**
   * Main prediction function that combines multiple indicators with adaptive scoring
   */
  async predict(marketData: MarketData): Promise<Prediction> {
    const indicators = this.calculateIndicators(marketData);
    const reasoning: string[] = [];

    // Detect market regime for adaptive scoring
    const marketRegime = indicators.marketRegime || "sideways";
    const volatility = indicators.atr || 0;
    const volatilityPercent = (volatility / marketData.price) * 100;

    // Calculate adaptive weights based on market conditions
    const weights = this.calculateAdaptiveWeights(
      marketRegime,
      volatilityPercent
    );

    // Calculate signals based on indicators
    let buyScore = 0;
    let sellScore = 0;

    // RSI Analysis (Relative Strength Index) - Improved thresholds
    if (indicators.rsi !== undefined) {
      // Adaptive RSI thresholds based on volatility
      const rsiOversold = volatilityPercent > 3 ? 25 : 30;
      const rsiOverbought = volatilityPercent > 3 ? 75 : 70;

      if (indicators.rsi < rsiOversold) {
        const score =
          (weights.rsi * (rsiOversold - indicators.rsi)) / rsiOversold;
        buyScore += score;
        reasoning.push(
          `RSI is oversold (${indicators.rsi.toFixed(
            2
          )} < ${rsiOversold}), strong buy signal`
        );
      } else if (indicators.rsi > rsiOverbought) {
        const score =
          (weights.rsi * (indicators.rsi - rsiOverbought)) /
          (100 - rsiOverbought);
        sellScore += score;
        reasoning.push(
          `RSI is overbought (${indicators.rsi.toFixed(
            2
          )} > ${rsiOverbought}), strong sell signal`
        );
      } else if (indicators.rsi > 40 && indicators.rsi < 60) {
        // Neutral zone - slightly reduces other signals
        buyScore -= 5;
        sellScore -= 5;
        reasoning.push(
          `RSI is neutral (${indicators.rsi.toFixed(2)}), mixed signals`
        );
      }
    }

    // Moving Average Analysis - Multiple MAs with crossover detection
    if (indicators.sma20 && indicators.sma50) {
      const priceVsSMA20 = marketData.price / indicators.sma20;
      const priceVsSMA50 = marketData.price / indicators.sma50;
      const maCross = indicators.sma20 > indicators.sma50; // Golden cross if true

      // Golden Cross / Death Cross
      if (maCross && priceVsSMA20 > 1.01) {
        const score = weights.ma * Math.min(priceVsSMA20 - 1, 0.05) * 20;
        buyScore += score;
        reasoning.push(
          `Golden Cross: SMA20 > SMA50, price above SMA20 (${(
            (priceVsSMA20 - 1) *
            100
          ).toFixed(2)}%)`
        );
      } else if (!maCross && priceVsSMA20 < 0.99) {
        const score = weights.ma * Math.min(1 - priceVsSMA20, 0.05) * 20;
        sellScore += score;
        reasoning.push(
          `Death Cross: SMA20 < SMA50, price below SMA20 (${(
            (1 - priceVsSMA20) *
            100
          ).toFixed(2)}%)`
        );
      }

      // Price position relative to MAs
      if (priceVsSMA50 < 0.98) {
        buyScore += weights.ma * 0.3;
        reasoning.push(`Price below SMA50, potential support level`);
      } else if (priceVsSMA50 > 1.02) {
        sellScore += weights.ma * 0.3;
        reasoning.push(`Price above SMA50, potential resistance level`);
      }
    }

    // MACD Analysis
    if (indicators.macd) {
      const { macd, signal, histogram } = indicators.macd;
      const macdCross = macd > signal;

      if (macdCross && histogram > 0 && macd > 0) {
        const score = weights.macd * Math.min(Math.abs(histogram) / 10, 1);
        buyScore += score * 30;
        reasoning.push(
          `MACD bullish: MACD > Signal (${macd.toFixed(4)} > ${signal.toFixed(
            4
          )}), histogram positive`
        );
      } else if (!macdCross && histogram < 0 && macd < 0) {
        const score = weights.macd * Math.min(Math.abs(histogram) / 10, 1);
        sellScore += score * 30;
        reasoning.push(
          `MACD bearish: MACD < Signal (${macd.toFixed(4)} < ${signal.toFixed(
            4
          )}), histogram negative`
        );
      }
    }

    // Bollinger Bands Analysis
    if (indicators.bollinger) {
      const { upper, lower, middle, position, bandWidth } =
        indicators.bollinger;
      const currentPrice = marketData.price;

      // Bollinger Band Squeeze (low volatility, potential breakout)
      if (bandWidth < 2) {
        reasoning.push(
          `Bollinger Band Squeeze detected (width: ${bandWidth.toFixed(
            2
          )}%), potential breakout`
        );
      }

      // Price near bands
      if (position < -0.9) {
        // Price near lower band - potential buy
        const score = weights.bollinger * Math.abs(position) * 25;
        buyScore += score;
        reasoning.push(
          `Price at lower Bollinger Band (${currentPrice.toFixed(
            2
          )} < ${lower.toFixed(2)}), oversold condition`
        );
      } else if (position > 0.9) {
        // Price near upper band - potential sell
        const score = weights.bollinger * Math.abs(position) * 25;
        sellScore += score;
        reasoning.push(
          `Price at upper Bollinger Band (${currentPrice.toFixed(
            2
          )} > ${upper.toFixed(2)}), overbought condition`
        );
      }

      // Price position relative to middle band
      if (position > 0 && position < 0.3) {
        // Price just above middle band - potential bullish momentum
        buyScore += weights.bollinger * 5;
        reasoning.push(`Price above Bollinger middle band, bullish momentum`);
      } else if (position < 0 && position > -0.3) {
        // Price just below middle band - potential bearish momentum
        sellScore += weights.bollinger * 5;
        reasoning.push(`Price below Bollinger middle band, bearish momentum`);
      }
    }

    // Improved Momentum Analysis with Volatility Adjustment
    if (indicators.momentum) {
      const {
        momentum,
        momentumRate,
        volatility: momentumVol,
      } = indicators.momentum;
      const momentumStrength = Math.abs(momentum) / (momentumVol || 1); // Normalize by volatility

      // Strong momentum with acceleration
      if (momentum > 2 && momentumRate > 0) {
        const score = weights.momentum * Math.min(momentumStrength / 2, 1) * 25;
        buyScore += score;
        reasoning.push(
          `Strong positive momentum (${momentum.toFixed(
            2
          )}%) with acceleration (${momentumRate.toFixed(2)}%)`
        );
      } else if (momentum < -2 && momentumRate < 0) {
        const score = weights.momentum * Math.min(momentumStrength / 2, 1) * 25;
        sellScore += score;
        reasoning.push(
          `Strong negative momentum (${momentum.toFixed(
            2
          )}%) with acceleration (${momentumRate.toFixed(2)}%)`
        );
      }

      // Momentum divergence warning
      if (momentum > 0 && momentumRate < -1) {
        sellScore += 10;
        reasoning.push(
          `Momentum divergence: positive momentum but decreasing rate`
        );
      } else if (momentum < 0 && momentumRate > 1) {
        buyScore += 10;
        reasoning.push(
          `Momentum divergence: negative momentum but increasing rate`
        );
      }
    }

    // Enhanced Volume Trend Analysis
    if (indicators.volumeTrend === "increasing") {
      buyScore += weights.volume * 15;
      reasoning.push(
        `Increasing volume suggests strong market interest and trend confirmation`
      );
    } else if (indicators.volumeTrend === "decreasing") {
      sellScore += weights.volume * 10;
      reasoning.push(
        `Decreasing volume suggests weakening trend, potential reversal`
      );
    } else if (indicators.volumeTrend === "stable") {
      // Stable volume in trending market suggests continuation
      if (marketRegime !== "sideways") {
        if (buyScore > sellScore) buyScore += 5;
        else if (sellScore > buyScore) sellScore += 5;
      }
    }

    // Market Regime Consideration
    if (marketRegime === "bull") {
      buyScore += 10;
      reasoning.push(`Bull market detected, favorable for long positions`);
    } else if (marketRegime === "bear") {
      sellScore += 10;
      reasoning.push(
        `Bear market detected, favorable for short positions or holding`
      );
    } else {
      // Sideways market - reduce confidence
      buyScore *= 0.9;
      sellScore *= 0.9;
      reasoning.push(`Sideways market detected, reduced confidence in signals`);
    }

    // 24h Price Change Analysis (adjusted by volatility)
    const normalized24hChange =
      marketData.priceChangePercent24h / (volatilityPercent || 1);
    if (normalized24hChange > 1.5 && volatilityPercent < 5) {
      sellScore += weights.volume * 10;
      reasoning.push(
        `Strong 24h gain (${marketData.priceChangePercent24h.toFixed(
          2
        )}%) relative to volatility, consider profit-taking`
      );
    } else if (normalized24hChange < -1.5 && volatilityPercent < 5) {
      buyScore += weights.volume * 10;
      reasoning.push(
        `Significant 24h decline (${marketData.priceChangePercent24h.toFixed(
          2
        )}%) relative to volatility, potential buying opportunity`
      );
    }

    // Determine signal with improved confidence calculation
    const scoreDiff = Math.abs(buyScore - sellScore);
    const totalScore = buyScore + sellScore;
    const confidence = totalScore > 0 ? (scoreDiff / totalScore) * 100 : 0;
    let signal: "BUY" | "SELL" | "HOLD";

    // Adaptive confidence threshold based on market regime
    const confidenceThreshold = marketRegime === "sideways" ? 30 : 25;

    if (
      confidence < confidenceThreshold ||
      Math.abs(buyScore - sellScore) < 15
    ) {
      signal = "HOLD";
      reasoning.push(
        `Indicators are mixed (confidence: ${confidence.toFixed(
          1
        )}%), holding position`
      );
    } else if (buyScore > sellScore) {
      signal = "BUY";
    } else {
      signal = "SELL";
    }

    // Enhanced price prediction
    const predictedPrice = this.predictPrice(marketData, indicators);

    // Calculate risk-reward if we have a signal
    let riskReward = undefined;
    if (signal !== "HOLD" && indicators.atr) {
      riskReward = this.calculateRiskReward(
        signal,
        marketData.price,
        indicators
      );
      if (riskReward.riskReward > 1.5) {
        reasoning.push(
          `Favorable risk-reward ratio: ${riskReward.riskReward.toFixed(
            2
          )}:1 (Stop: $${riskReward.suggestedStopLoss.toFixed(
            2
          )}, Target: $${riskReward.suggestedTakeProfit.toFixed(2)})`
        );
      }
    }

    const prediction: Prediction = {
      signal,
      confidence: Math.min(confidence, 100),
      predictedPrice,
      reasoning,
      indicators,
      riskReward,
    };

    logger.info(
      `🔮 Prediction: ${signal} (Confidence: ${confidence.toFixed(1)}%)`
    );
    if (marketRegime) {
      logger.info(`   Market Regime: ${marketRegime.toUpperCase()}`);
    }
    if (riskReward) {
      logger.info(`   Risk-Reward: ${riskReward.riskReward.toFixed(2)}:1`);
    }
    logger.info(`   Top Reasons: ${reasoning.slice(0, 3).join("; ")}`);

    return prediction;
  }

  /**
   * Calculate all technical indicators
   */
  private calculateIndicators(marketData: MarketData) {
    const indicators: Prediction["indicators"] = {};

    if (marketData.klineData && marketData.klineData.length > 0) {
      // Calculate RSI with Wilder's smoothing
      indicators.rsi = this.calculateRSI(marketData.klineData);

      // Calculate multiple Moving Averages
      indicators.sma20 = this.calculateSMA(marketData.klineData, 20);
      indicators.sma50 = this.calculateSMA(marketData.klineData, 50);
      indicators.ema12 = this.calculateEMA(marketData.klineData, 12);
      indicators.ema26 = this.calculateEMA(marketData.klineData, 26);

      // Calculate MACD
      if (indicators.ema12 !== undefined && indicators.ema26 !== undefined) {
        indicators.macd = this.calculateMACD(
          marketData.klineData,
          indicators.ema12,
          indicators.ema26
        );
      }

      // Calculate Bollinger Bands
      indicators.bollinger = this.calculateBollingerBands(marketData.klineData);

      // Calculate ATR (Average True Range) for volatility
      indicators.atr = this.calculateATR(marketData.klineData);

      // Calculate improved momentum with volatility
      indicators.momentum = this.calculateMomentum(marketData.klineData);

      // Analyze volume trend
      indicators.volumeTrend = this.analyzeVolumeTrend(marketData.klineData);

      // Detect market regime
      indicators.marketRegime = this.detectMarketRegime(
        marketData.klineData,
        marketData.price,
        indicators.sma20,
        indicators.sma50
      );
    }

    return indicators;
  }

  /**
   * Calculate RSI (Relative Strength Index) using Wilder's Smoothing Method
   */
  private calculateRSI(klines: any[], period: number = 14): number {
    if (klines.length < period + 1) return 50; // Default neutral

    const closes = klines.map((k) => parseFloat(k.close));

    // Calculate initial average gain and loss
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 1; i <= period; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) {
        avgGain += change;
      } else {
        avgLoss += Math.abs(change);
      }
    }

    avgGain /= period;
    avgLoss /= period;

    // Wilder's Smoothing for subsequent periods
    for (let i = period + 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;

      // Wilder's smoothing formula: EMA = (Previous EMA * (N-1) + Current Value) / N
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

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
   * Calculate EMA (Exponential Moving Average)
   */
  private calculateEMA(klines: any[], period: number): number {
    if (klines.length < period) {
      return parseFloat(klines[klines.length - 1].close);
    }

    const closes = klines.map((k) => parseFloat(k.close));
    const multiplier = 2 / (period + 1);

    // Start with SMA
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;

    // Calculate EMA for remaining periods
    for (let i = period; i < closes.length; i++) {
      ema = (closes[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  /**
   * Calculate improved momentum with volatility and acceleration
   */
  private calculateMomentum(
    klines: any[],
    period: number = 10
  ): {
    momentum: number;
    momentumRate: number;
    volatility: number;
  } {
    if (klines.length < period * 2) {
      return { momentum: 0, momentumRate: 0, volatility: 0 };
    }

    const recent = klines.slice(-period);
    const closes = recent.map((k) => parseFloat(k.close));

    // Calculate momentum (price change over period)
    const first = closes[0];
    const last = closes[closes.length - 1];
    const momentum = ((last - first) / first) * 100;

    // Calculate momentum rate (acceleration)
    const midPoint = Math.floor(closes.length / 2);
    const firstHalf = closes.slice(0, midPoint);
    const secondHalf = closes.slice(midPoint);

    const firstHalfStart = firstHalf[0];
    const firstHalfEnd = firstHalf[firstHalf.length - 1];
    const secondHalfStart = secondHalf[0];
    const secondHalfEnd = secondHalf[secondHalf.length - 1];

    const firstHalfMomentum =
      ((firstHalfEnd - firstHalfStart) / firstHalfStart) * 100;
    const secondHalfMomentum =
      ((secondHalfEnd - secondHalfStart) / secondHalfStart) * 100;
    const momentumRate = secondHalfMomentum - firstHalfMomentum;

    // Calculate volatility (standard deviation as percentage of mean)
    const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
    const variance =
      closes.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) /
      closes.length;
    const volatility = (Math.sqrt(variance) / mean) * 100;

    return { momentum, momentumRate, volatility };
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  private calculateMACD(
    klines: any[],
    ema12: number,
    ema26: number
  ): {
    macd: number;
    signal: number;
    histogram: number;
  } {
    const macd = ema12 - ema26;

    // For signal line, we need 9-period EMA of MACD
    // Since we don't have historical MACD values, we approximate
    // In production, you'd maintain a rolling window of MACD values
    const signalApproximation = macd * 0.3; // Simplified approximation
    const histogram = macd - signalApproximation;

    return {
      macd,
      signal: signalApproximation,
      histogram,
    };
  }

  /**
   * Calculate Bollinger Bands
   */
  private calculateBollingerBands(
    klines: any[],
    period: number = 20,
    stdDev: number = 2
  ): {
    upper: number;
    middle: number;
    lower: number;
    bandWidth: number;
    position: number;
  } {
    if (klines.length < period) {
      const currentPrice = parseFloat(klines[klines.length - 1].close);
      return {
        upper: currentPrice * 1.02,
        middle: currentPrice,
        lower: currentPrice * 0.98,
        bandWidth: 2,
        position: 0,
      };
    }

    const sma = this.calculateSMA(klines, period);
    const recent = klines.slice(-period);
    const closes = recent.map((k) => parseFloat(k.close));

    // Calculate standard deviation
    const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
    const variance =
      closes.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) /
      closes.length;
    const standardDev = Math.sqrt(variance);

    const upper = sma + standardDev * stdDev;
    const lower = sma - standardDev * stdDev;
    const bandWidth = ((standardDev * stdDev * 2) / sma) * 100;

    // Position in band: -1 (lower) to 1 (upper)
    const currentPrice = parseFloat(klines[klines.length - 1].close);
    const position =
      bandWidth > 0 ? (currentPrice - sma) / (standardDev * stdDev) : 0;

    return {
      upper,
      middle: sma,
      lower,
      bandWidth,
      position: Math.max(-1, Math.min(1, position)), // Clamp between -1 and 1
    };
  }

  /**
   * Calculate ATR (Average True Range) for volatility measurement
   */
  private calculateATR(klines: any[], period: number = 14): number {
    if (klines.length < period + 1) return 0;

    const trueRanges: number[] = [];

    for (let i = 1; i < klines.length; i++) {
      const high = parseFloat(klines[i].high);
      const low = parseFloat(klines[i].low);
      const prevClose = parseFloat(klines[i - 1].close);

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    // Use Wilder's smoothing for ATR
    let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < trueRanges.length; i++) {
      atr = (atr * (period - 1) + trueRanges[i]) / period;
    }

    return atr;
  }

  /**
   * Detect market regime (bull, bear, or sideways)
   */
  private detectMarketRegime(
    klines: any[],
    currentPrice: number,
    sma20?: number,
    sma50?: number
  ): "bull" | "bear" | "sideways" {
    if (!sma20 || !sma50 || klines.length < 50) return "sideways";

    const sma200 =
      klines.length >= 200
        ? this.calculateSMA(klines, 200)
        : this.calculateSMA(klines, Math.min(klines.length, 100));

    // Price position relative to MAs
    const aboveSMA20 = currentPrice > sma20;
    const aboveSMA50 = currentPrice > sma50;
    const aboveSMA200 = sma200 ? currentPrice > sma200 : false;

    // MA alignment
    const maBullish = sma20 > sma50 && (sma200 ? sma50 > sma200 : true);
    const maBearish = sma20 < sma50 && (sma200 ? sma50 < sma200 : true);

    // Determine regime
    if (aboveSMA20 && aboveSMA50 && maBullish) {
      return "bull";
    } else if (!aboveSMA20 && !aboveSMA50 && maBearish) {
      return "bear";
    } else {
      return "sideways";
    }
  }

  /**
   * Calculate adaptive weights based on market conditions
   */
  private calculateAdaptiveWeights(
    marketRegime: "bull" | "bear" | "sideways",
    volatilityPercent: number
  ): {
    rsi: number;
    ma: number;
    momentum: number;
    volume: number;
    macd: number;
    bollinger: number;
  } {
    const baseWeights = {
      rsi: 25,
      ma: 25,
      momentum: 20,
      volume: 15,
      macd: 15,
      bollinger: 10,
    };

    // Adjust weights in volatile markets
    if (volatilityPercent > 5) {
      // High volatility: reduce momentum weight, increase bands and RSI
      baseWeights.momentum *= 0.7;
      baseWeights.bollinger *= 1.3;
      baseWeights.rsi *= 1.2;
    }

    // Adjust weights in trending markets
    if (marketRegime !== "sideways") {
      baseWeights.ma *= 1.2;
      baseWeights.momentum *= 1.1;
      baseWeights.macd *= 1.1;
    } else {
      // Sideways market: prefer bands and RSI
      baseWeights.bollinger *= 1.2;
      baseWeights.rsi *= 1.1;
      baseWeights.ma *= 0.9;
    }

    return baseWeights;
  }

  /**
   * Calculate risk-reward ratio and suggest stop-loss/take-profit levels
   */
  private calculateRiskReward(
    signal: "BUY" | "SELL",
    currentPrice: number,
    indicators: Prediction["indicators"]
  ): {
    riskReward: number;
    suggestedStopLoss: number;
    suggestedTakeProfit: number;
  } {
    if (!indicators.atr) {
      return {
        riskReward: 1,
        suggestedStopLoss: currentPrice,
        suggestedTakeProfit: currentPrice,
      };
    }

    // Use ATR to determine stop loss (2x ATR)
    const stopLossPercent = (indicators.atr / currentPrice) * 2;
    const takeProfitPercent = stopLossPercent * 2; // 2:1 risk-reward ratio

    let suggestedStopLoss: number;
    let suggestedTakeProfit: number;

    if (signal === "BUY") {
      suggestedStopLoss = currentPrice * (1 - stopLossPercent / 100);
      suggestedTakeProfit = currentPrice * (1 + takeProfitPercent / 100);
    } else {
      suggestedStopLoss = currentPrice * (1 + stopLossPercent / 100);
      suggestedTakeProfit = currentPrice * (1 - takeProfitPercent / 100);
    }

    const riskReward = takeProfitPercent / stopLossPercent;

    return {
      riskReward,
      suggestedStopLoss,
      suggestedTakeProfit,
    };
  }

  /**
   * Analyze volume trend with improved logic
   */
  private analyzeVolumeTrend(
    klines: any[]
  ): "increasing" | "decreasing" | "stable" {
    if (klines.length < 10) return "stable";

    // Use longer period for better trend detection
    const recent = klines.slice(-10);
    const volumes = recent.map((k) => parseFloat(k.volume));

    // Calculate moving average of volumes
    const firstHalf = volumes.slice(0, Math.floor(volumes.length / 2));
    const secondHalf = volumes.slice(Math.floor(volumes.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    // Adjust thresholds based on volatility
    const threshold = 15; // 15% change threshold

    if (change > threshold) return "increasing";
    if (change < -threshold) return "decreasing";
    return "stable";
  }

  /**
   * Predict future price using multiple indicators
   */
  private predictPrice(
    marketData: MarketData,
    indicators: Prediction["indicators"]
  ): number {
    const currentPrice = marketData.price;
    let predictedChange = 0;
    let weightSum = 0;

    // Use momentum for prediction
    if (indicators.momentum) {
      const { momentum, momentumRate } = indicators.momentum;
      // Combine momentum with acceleration, adjusted for volatility
      const adjustedMomentum = momentum * 0.4 + momentumRate * 0.2;
      predictedChange += adjustedMomentum * 0.5; // Conservative multiplier
      weightSum += 1;
    }

    // Use MA trend
    if (indicators.sma20 && indicators.sma50) {
      const maTrend = (indicators.sma20 - indicators.sma50) / indicators.sma50;
      predictedChange += maTrend * 100 * 0.3;
      weightSum += 1;
    }

    // Use MACD histogram
    if (indicators.macd) {
      const macdSignal = indicators.macd.histogram * 0.01;
      predictedChange += macdSignal * 0.2;
      weightSum += 1;
    }

    // Average the predictions
    if (weightSum > 0) {
      predictedChange = predictedChange / weightSum;
    }

    // Cap prediction to reasonable bounds (±10%)
    predictedChange = Math.max(-10, Math.min(10, predictedChange));

    return currentPrice * (1 + predictedChange / 100);
  }
}
