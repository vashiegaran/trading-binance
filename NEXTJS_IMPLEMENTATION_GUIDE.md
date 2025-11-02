# Next.js Analytics Dashboard - Complete Implementation Guide

This document contains everything you need to build the analytics dashboard in your Next.js project.

---

## 1. Project Setup

### Initialize Next.js Project

```bash
npx create-next-app@latest trading-analytics-dashboard --typescript --tailwind --app --no-src-dir
cd trading-analytics-dashboard
```

### Install Dependencies

```bash
npm install mongodb recharts date-fns
npm install -D @types/node
```

---

## 2. Environment Configuration

### Create `.env.local`

```env
MONGODB_URI=mongodb://localhost:27017/trading_bot
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trading_bot

MONGODB_DB_NAME=trading_bot
```

---

## 3. Project Structure

Create this structure:

```
trading-analytics-dashboard/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   ├── api/
│   │   ├── trades/
│   │   │   └── route.ts
│   │   ├── summary/
│   │   │   └── route.ts
│   │   ├── metrics/
│   │   │   └── route.ts
│   │   ├── balance/
│   │   │   └── route.ts
│   │   └── charts/
│   │       ├── profit/
│   │       │   └── route.ts
│   │       └── portfolio/
│   │           └── route.ts
│   ├── components/
│   │   ├── DateRangePicker.tsx
│   │   ├── MetricsCards.tsx
│   │   ├── ProfitChart.tsx
│   │   ├── PortfolioChart.tsx
│   │   ├── TradesTable.tsx
│   │   └── LoadingSpinner.tsx
│   └── lib/
│       ├── mongodb.ts
│       ├── queries.ts
│       └── utils.ts
└── types/
    └── index.ts
```

---

## 4. TypeScript Types

### `types/index.ts`

```typescript
export interface TradeRecord {
  _id?: string;
  timestamp: string | Date;
  type: "BUY" | "SELL";
  symbol: string;
  quantity: number;
  price: number;
  amount: number;
  balanceBefore: { sol: number; usdt: number };
  balanceAfter: { sol: number; usdt: number };
  orderId?: string;
  fees?: { amount: number; currency: string };
  botRunId?: string;
  createdAt?: Date;
  updatedAt?: Date;
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
  winRate?: number;
  averageProfitPerTrade?: number;
  largestWin?: number;
  largestLoss?: number;
}

export interface HourlyMetric {
  hour: Date;
  trades: {
    count: number;
    buyCount: number;
    sellCount: number;
    volume: number;
  };
  profit: {
    amount: number;
    percent: number;
    cumulative: number;
  };
  balances: {
    sol: number;
    usdt: number;
    totalValue: number;
  };
  marketPrice: number;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}
```

---

## 5. MongoDB Connection

### `app/lib/mongodb.ts`

```typescript
import { MongoClient, Db } from "mongodb";

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export async function getDatabase(): Promise<Db> {
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB_NAME || "trading_bot");
}
```

---

## 6. MongoDB Query Functions

### `app/lib/queries.ts`

```typescript
import { getDatabase } from "./mongodb";
import { TradeRecord, ProfitSummary, HourlyMetric } from "@/types";
import { Db } from "mongodb";

export async function getTrades(
  startDate: Date,
  endDate: Date,
  limit: number = 1000,
  offset: number = 0
): Promise<{ trades: TradeRecord[]; total: number }> {
  const db = await getDatabase();
  const collection = db.collection("trades");

  const query = {
    timestamp: {
      $gte: startDate,
      $lte: endDate,
    },
  };

  const trades = await collection
    .find(query)
    .sort({ timestamp: -1 })
    .skip(offset)
    .limit(limit)
    .toArray();

  const total = await collection.countDocuments(query);

  return {
    trades: trades.map(formatTrade),
    total,
  };
}

export async function getProfitSummary(
  startDate: Date,
  endDate: Date
): Promise<ProfitSummary> {
  const db = await getDatabase();
  const collection = db.collection("trades");

  const trades = await collection
    .find({
      timestamp: { $gte: startDate, $lte: endDate },
    })
    .sort({ timestamp: 1 })
    .toArray();

  const buyTrades = trades.filter((t: any) => t.type === "BUY");
  const sellTrades = trades.filter((t: any) => t.type === "SELL");

  const totalInvested = buyTrades.reduce(
    (sum: number, t: any) => sum + (t.amount || 0),
    0
  );
  const totalReturned = sellTrades.reduce(
    (sum: number, t: any) => sum + (t.amount || 0),
    0
  );
  const totalProfit = totalReturned - totalInvested;
  const totalProfitPercent =
    totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  const lastTrade = trades[trades.length - 1];
  const currentHoldings = lastTrade
    ? {
        sol: lastTrade.balanceAfter?.sol || 0,
        usdt: lastTrade.balanceAfter?.usdt || 0,
      }
    : { sol: 0, usdt: 0 };

  const marketPrice = await getCurrentMarketPrice();
  const currentHoldingsValue =
    currentHoldings.sol * marketPrice + currentHoldings.usdt;

  const overallProfit = totalProfit + (currentHoldingsValue - totalInvested);
  const overallProfitPercent =
    totalInvested > 0 ? (overallProfit / totalInvested) * 100 : 0;

  const { winRate, averageProfitPerTrade, largestWin, largestLoss } =
    calculateWinRateStats(buyTrades, sellTrades);

  return {
    totalTrades: trades.length,
    buyTrades: buyTrades.length,
    sellTrades: sellTrades.length,
    totalInvested,
    totalReturned,
    totalProfit,
    totalProfitPercent,
    currentHoldings,
    currentHoldingsValue,
    overallProfit,
    overallProfitPercent,
    winRate,
    averageProfitPerTrade,
    largestWin,
    largestLoss,
  };
}

export async function getHourlyMetrics(
  startDate: Date,
  endDate: Date
): Promise<HourlyMetric[]> {
  const db = await getDatabase();
  const collection = db.collection("hourly_metrics");

  const metrics = await collection
    .find({
      hour: {
        $gte: startDate,
        $lte: endDate,
      },
    })
    .sort({ hour: 1 })
    .toArray();

  return metrics.map((m: any) => ({
    hour: new Date(m.hour),
    trades: m.trades,
    profit: m.profit,
    balances: m.balances,
    marketPrice: m.marketPrice,
  }));
}

export async function getProfitChartData(
  startDate: Date,
  endDate: Date,
  granularity: "hourly" | "daily" = "daily"
): Promise<Array<{ date: Date; profit: number; cumulative: number }>> {
  const db = await getDatabase();
  const collection = db.collection("trades");

  const groupBy =
    granularity === "hourly"
      ? {
          $dateToString: { format: "%Y-%m-%d-%H", date: "$timestamp" },
        }
      : {
          $dateToString: { format: "%Y-%m-%d", date: "$timestamp" },
        };

  const pipeline = [
    {
      $match: {
        timestamp: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: groupBy,
        buyAmount: {
          $sum: { $cond: [{ $eq: ["$type", "BUY"] }, "$amount", 0] },
        },
        sellAmount: {
          $sum: { $cond: [{ $eq: ["$type", "SELL"] }, "$amount", 0] },
        },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ];

  const results = await collection.aggregate(pipeline).toArray();

  let cumulative = 0;
  return results.map((r) => {
    const profit = r.sellAmount - r.buyAmount;
    cumulative += profit;
    return {
      date: new Date(r._id.replace(/-/g, granularity === "hourly" ? "-" : "-")),
      profit,
      cumulative,
    };
  });
}

export async function getPortfolioChartData(
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: Date; sol: number; usdt: number; total: number }>> {
  const db = await getDatabase();
  const collection = db.collection("bot_snapshots");

  const snapshots = await collection
    .find({
      timestamp: { $gte: startDate, $lte: endDate },
    })
    .sort({ timestamp: 1 })
    .toArray();

  return snapshots.map((s: any) => ({
    date: new Date(s.timestamp),
    sol: s.balances?.sol || 0,
    usdt: s.balances?.usdt || 0,
    total: s.balances?.totalValue || 0,
  }));
}

export async function getCurrentBalance(): Promise<{
  sol: number;
  usdt: number;
}> {
  const db = await getDatabase();
  const collection = db.collection("bot_snapshots");

  const latest = await collection.findOne({}, { sort: { timestamp: -1 } });

  return latest
    ? {
        sol: latest.balances?.sol || 0,
        usdt: latest.balances?.usdt || 0,
      }
    : { sol: 0, usdt: 0 };
}

async function getCurrentMarketPrice(): Promise<number> {
  const db = await getDatabase();
  const collection = db.collection("bot_snapshots");

  const latest = await collection.findOne({}, { sort: { timestamp: -1 } });

  return latest?.marketData?.price || 0;
}

function formatTrade(trade: any): TradeRecord {
  return {
    _id: trade._id.toString(),
    timestamp: trade.timestamp,
    type: trade.type,
    symbol: trade.symbol,
    quantity: trade.quantity,
    price: trade.price,
    amount: trade.amount,
    balanceBefore: trade.balanceBefore,
    balanceAfter: trade.balanceAfter,
    orderId: trade.orderId,
    fees: trade.fees,
    botRunId: trade.botRunId,
    createdAt: trade.createdAt,
    updatedAt: trade.updatedAt,
  };
}

function calculateWinRateStats(
  buyTrades: any[],
  sellTrades: any[]
): {
  winRate: number;
  averageProfitPerTrade: number;
  largestWin: number;
  largestLoss: number;
} {
  const matchedPairs: Array<{ profit: number }> = [];
  let buyIndex = 0;
  let sellIndex = 0;

  while (buyIndex < buyTrades.length && sellIndex < sellTrades.length) {
    const buy = buyTrades[buyIndex];
    const sell = sellTrades[sellIndex];

    if (new Date(sell.timestamp) > new Date(buy.timestamp)) {
      const profit = sell.amount - buy.amount;
      matchedPairs.push({ profit });
      buyIndex++;
      sellIndex++;
    } else {
      buyIndex++;
    }
  }

  const wins = matchedPairs.filter((p) => p.profit > 0).length;
  const winRate =
    matchedPairs.length > 0 ? (wins / matchedPairs.length) * 100 : 0;

  const profits = matchedPairs.map((p) => p.profit);
  const averageProfitPerTrade =
    profits.length > 0
      ? profits.reduce((sum, p) => sum + p, 0) / profits.length
      : 0;

  const largestWin = Math.max(...profits, 0);
  const largestLoss = Math.min(...profits, 0);

  return {
    winRate,
    averageProfitPerTrade,
    largestWin,
    largestLoss,
  };
}
```

---

## 7. API Routes

### `app/api/trades/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getTrades } from "@/app/lib/queries";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = new Date(searchParams.get("startDate") || new Date(0));
    const endDate = new Date(searchParams.get("endDate") || new Date());
    const limit = parseInt(searchParams.get("limit") || "1000", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const result = await getTrades(startDate, endDate, limit, offset);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching trades:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### `app/api/summary/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getProfitSummary } from "@/app/lib/queries";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = new Date(searchParams.get("startDate") || new Date(0));
    const endDate = new Date(searchParams.get("endDate") || new Date());

    const summary = await getProfitSummary(startDate, endDate);

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error("Error fetching summary:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### `app/api/metrics/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getHourlyMetrics } from "@/app/lib/queries";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = new Date(searchParams.get("startDate") || new Date(0));
    const endDate = new Date(searchParams.get("endDate") || new Date());

    const metrics = await getHourlyMetrics(startDate, endDate);

    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error("Error fetching metrics:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### `app/api/balance/route.ts`

```typescript
import { NextResponse } from "next/server";
import { getCurrentBalance } from "@/app/lib/queries";

export async function GET() {
  try {
    const balance = await getCurrentBalance();
    return NextResponse.json(balance);
  } catch (error: any) {
    console.error("Error fetching balance:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### `app/api/charts/profit/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getProfitChartData } from "@/app/lib/queries";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = new Date(searchParams.get("startDate") || new Date(0));
    const endDate = new Date(searchParams.get("endDate") || new Date());
    const granularity = (searchParams.get("granularity") || "daily") as
      | "hourly"
      | "daily";

    const data = await getProfitChartData(startDate, endDate, granularity);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching profit chart data:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### `app/api/charts/portfolio/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getPortfolioChartData } from "@/app/lib/queries";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = new Date(searchParams.get("startDate") || new Date(0));
    const endDate = new Date(searchParams.get("endDate") || new Date());

    const data = await getPortfolioChartData(startDate, endDate);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching portfolio chart data:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## 8. React Components

### `app/components/DateRangePicker.tsx`

```typescript
"use client";

import { useState, useEffect } from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChange: (start: Date, end: Date) => void;
}

const PRESETS = [
  { label: "Today", start: startOfDay(new Date()), end: endOfDay(new Date()) },
  {
    label: "Last 7 Days",
    start: startOfDay(subDays(new Date(), 7)),
    end: endOfDay(new Date()),
  },
  {
    label: "Last 30 Days",
    start: startOfDay(subDays(new Date(), 30)),
    end: endOfDay(new Date()),
  },
  {
    label: "Last 90 Days",
    start: startOfDay(subDays(new Date(), 90)),
    end: endOfDay(new Date()),
  },
];

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
}: DateRangePickerProps) {
  const [start, setStart] = useState(format(startDate, "yyyy-MM-dd"));
  const [end, setEnd] = useState(format(endDate, "yyyy-MM-dd"));

  useEffect(() => {
    setStart(format(startDate, "yyyy-MM-dd"));
    setEnd(format(endDate, "yyyy-MM-dd"));
  }, [startDate, endDate]);

  const handlePreset = (preset: (typeof PRESETS)[0]) => {
    onChange(preset.start, preset.end);
  };

  const handleCustomChange = () => {
    const newStart = new Date(start + "T00:00:00");
    const newEnd = new Date(end + "T23:59:59");
    onChange(newStart, newEnd);
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-lg shadow-md">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handlePreset(preset)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="flex gap-4 items-center">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input
            type="date"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              handleCustomChange();
            }}
            className="border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input
            type="date"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              handleCustomChange();
            }}
            className="border rounded px-3 py-2"
          />
        </div>
      </div>
    </div>
  );
}
```

### `app/components/MetricsCards.tsx`

```typescript
"use client";

import { ProfitSummary } from "@/types";

interface MetricsCardsProps {
  summary: ProfitSummary | null;
  loading: boolean;
}

export default function MetricsCards({ summary, loading }: MetricsCardsProps) {
  if (loading) {
    return <div className="text-center py-8">Loading metrics...</div>;
  }

  if (!summary) {
    return <div className="text-center py-8">No data available</div>;
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);

  const formatPercent = (value: number) =>
    `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-sm text-gray-600 mb-2">Total Profit/Loss</h3>
        <p
          className={`text-3xl font-bold ${
            summary.overallProfit >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {formatCurrency(summary.overallProfit)}
        </p>
        <p
          className={`text-sm mt-1 ${
            summary.overallProfitPercent >= 0
              ? "text-green-600"
              : "text-red-600"
          }`}
        >
          {formatPercent(summary.overallProfitPercent)}
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-sm text-gray-600 mb-2">Total Trades</h3>
        <p className="text-3xl font-bold">{summary.totalTrades}</p>
        <p className="text-sm text-gray-500 mt-1">
          {summary.buyTrades} buys, {summary.sellTrades} sells
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-sm text-gray-600 mb-2">Win Rate</h3>
        <p className="text-3xl font-bold">
          {summary.winRate?.toFixed(1) || 0}%
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Avg profit: {formatCurrency(summary.averageProfitPerTrade || 0)}
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-sm text-gray-600 mb-2">Total Invested</h3>
        <p className="text-3xl font-bold">
          {formatCurrency(summary.totalInvested)}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Returned: {formatCurrency(summary.totalReturned)}
        </p>
      </div>
    </div>
  );
}
```

### `app/components/ProfitChart.tsx`

```typescript
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { format } from "date-fns";

interface ProfitChartProps {
  data: Array<{ date: Date; profit: number; cumulative: number }>;
}

export default function ProfitChart({ data }: ProfitChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md text-center text-gray-500">
        No chart data available
      </div>
    );
  }

  const chartData = data.map((d) => ({
    date: format(new Date(d.date), "MMM dd"),
    profit: d.profit,
    cumulative: d.cumulative,
  }));

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Profit Over Time</h2>
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.3}
            name="Cumulative Profit"
          />
          <Line
            type="monotone"
            dataKey="profit"
            stroke="#3b82f6"
            name="Daily Profit"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### `app/components/TradesTable.tsx`

```typescript
"use client";

import { TradeRecord } from "@/types";
import { format } from "date-fns";

interface TradesTableProps {
  trades: TradeRecord[];
  loading: boolean;
}

export default function TradesTable({ trades, loading }: TradesTableProps) {
  if (loading) {
    return <div className="text-center py-8">Loading trades...</div>;
  }

  if (trades.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-md text-center text-gray-500">
        No trades found for selected date range
      </div>
    );
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold">Trade History</h2>
        <p className="text-sm text-gray-600 mt-1">
          {trades.length} trades found
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Symbol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Balance After
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {trades.map((trade) => (
              <tr key={trade._id || trade.timestamp.toString()}>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {format(new Date(trade.timestamp), "MMM dd, yyyy HH:mm")}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      trade.type === "BUY"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {trade.type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {trade.symbol}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {trade.quantity.toFixed(4)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {formatCurrency(trade.price)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {formatCurrency(trade.amount)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div>
                    <div>{trade.balanceAfter.sol.toFixed(4)} SOL</div>
                    <div className="text-gray-500">
                      {formatCurrency(trade.balanceAfter.usdt)} USDT
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## 9. Main Dashboard Page

### `app/page.tsx`

```typescript
"use client";

import { useState, useEffect } from "react";
import { startOfDay, endOfDay, subDays } from "date-fns";
import DateRangePicker from "./components/DateRangePicker";
import MetricsCards from "./components/MetricsCards";
import ProfitChart from "./components/ProfitChart";
import TradesTable from "./components/TradesTable";
import { TradeRecord, ProfitSummary } from "@/types";

export default function Dashboard() {
  const [startDate, setStartDate] = useState(
    startOfDay(subDays(new Date(), 30))
  );
  const [endDate, setEndDate] = useState(endOfDay(new Date()));
  const [summary, setSummary] = useState<ProfitSummary | null>(null);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [profitChartData, setProfitChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const [summaryRes, tradesRes, chartRes] = await Promise.all([
        fetch(`/api/summary?${params}`),
        fetch(`/api/trades?${params}&limit=100`),
        fetch(`/api/charts/profit?${params}`),
      ]);

      const [summaryData, tradesData, chartData] = await Promise.all([
        summaryRes.json(),
        tradesRes.json(),
        chartRes.json(),
      ]);

      setSummary(summaryData);
      setTrades(tradesData.trades || []);
      setProfitChartData(chartData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Trading Bot Analytics
          </h1>
          <p className="text-gray-600">Monitor your trading performance</p>
        </div>

        <div className="mb-6">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={handleDateRangeChange}
          />
        </div>

        <div className="mb-6">
          <MetricsCards summary={summary} loading={loading} />
        </div>

        <div className="mb-6">
          <ProfitChart data={profitChartData} />
        </div>

        <div>
          <TradesTable trades={trades} loading={loading} />
        </div>
      </div>
    </main>
  );
}
```

### `app/layout.tsx`

```typescript
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trading Bot Analytics Dashboard",
  description: "Analytics dashboard for Binance Solana Trading Bot",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

### `app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto",
    "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans",
    "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

---

## 10. TypeScript Path Configuration

### `tsconfig.json`

Make sure paths are configured:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

---

## 11. Implementation Checklist

- [ ] Initialize Next.js project
- [ ] Install dependencies
- [ ] Set up `.env.local` with MongoDB URI
- [ ] Create all directory structure
- [ ] Create TypeScript types
- [ ] Implement MongoDB connection
- [ ] Create query functions
- [ ] Build API routes
- [ ] Create React components
- [ ] Build main dashboard page
- [ ] Test with MongoDB data
- [ ] Add error handling
- [ ] Deploy

---

**This document contains everything needed to build the Next.js dashboard!**
