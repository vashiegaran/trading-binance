declare module '@binance/connector' {
  export class Spot {
    constructor(apiKey?: string, apiSecret?: string);

    ticker24hr(symbol?: string, symbols?: string[], type?: string, options?: object): Promise<{ data: any | any[] }>;
    tickerPrice(symbol?: string, symbols?: string[], options?: object): Promise<{ data: { price: string } | Array<{ price: string; symbol: string }> }>;
    klines(symbol: string, interval: string, params?: { limit?: number; startTime?: number; endTime?: number }): Promise<{ data: any[] }>;
    account(): Promise<{ data: { balances: Array<{ asset: string; free: string; locked: string }> } }>;
    newOrder(
      symbol: string,
      side: 'BUY' | 'SELL',
      type: 'MARKET' | 'LIMIT',
      params?: {
        quantity?: string | number;
        price?: string | number;
        timeInForce?: string;
      }
    ): Promise<{ data: any }>;
  }
}

