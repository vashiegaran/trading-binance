# Render Deployment Guide

## Quick Start

1. **Push to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Add Render deployment config"
   git push origin main
   ```

2. **Deploy on Render**:
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select `trading-binance` repository
   - Render will auto-detect `render.yaml` and use it

3. **Add Environment Variables** (IMPORTANT):
   
   Go to your service → Environment tab → Add these variables:
   
   ```env
   # Binance API Credentials (REQUIRED - Add via Dashboard, NOT in render.yaml)
   BINANCE_API_KEY=9KDS6GScVFrslnzvkIL6Tvb7zW14jN7q39G9OVtS1Lb1HI1TBKEbvYDdqHZ3inrz
   BINANCE_API_SECRET=U9DHCdcZm2loRXS6ZBIzzusmjwrKBgtpGdXb4Cf4IwSe7u9xKSXQa72lNcQ3LSn4
   
   # MongoDB Configuration (REQUIRED - Add via Dashboard)
   MONGODB_URI=mongodb+srv://vashie:35688653@trading.f8r1xba.mongodb.net/?appName=Trading
   MONGODB_DB_NAME=Trading
   
   # Trading Configuration
   TRADING_PAIR=SOLUSDT
   TRADE_AMOUNT_USDT=22
   MIN_CONFIDENCE=60
   USE_MARKET_ORDERS=true
   
   # Risk Management (Optimized for $20 SOL position)
   MAX_POSITION_VALUE_USDT=22
   STOP_LOSS_PERCENT=5
   MAX_DRAWDOWN_PERCENT=10
   TAKE_PROFIT_PERCENT=20
   EMERGENCY_STOP_LOSS_PERCENT=15
   MIN_TRADE_AMOUNT_USDT=5
   
   # Application Configuration
   NODE_ENV=production
   PORT=8080
   LOG_LEVEL=info
   PAPER_TRADING=false
   ```

## Important Notes

### ⚠️ Security Warning
Your `env.example` file contains real API keys and secrets! 

**IMMEDIATELY:**
1. **Revoke and regenerate** your Binance API keys (they're exposed in git)
2. **Change your MongoDB password** (it's exposed in git)
3. **Never commit secrets** to git again
4. Use `.env` file locally (already in .gitignore) and add secrets via Render Dashboard

### Free Tier Limitations
- **Service sleeps after 15 minutes** of inactivity
- Your bot runs every 15 minutes, which should keep it awake
- Consider **Starter plan ($7/month)** for guaranteed 24/7 uptime

### Health Check
- Health endpoint: `/health`
- Render will ping this to ensure service is running
- Already configured in `render.yaml`

### Monitoring
- View logs in Render Dashboard → Logs tab
- Bot runs every 15 minutes (configured in `src/index.ts`)
- Check logs to verify trades are executing

## Troubleshooting

### Bot not running?
1. Check Render logs for errors
2. Verify all environment variables are set
3. Check MongoDB connection (should see "✅ Connected to MongoDB" in logs)
4. Verify Binance API keys are valid

### Service sleeping?
- Free tier services sleep after inactivity
- Your cron job should wake it up every 15 minutes
- Upgrade to Starter plan for 24/7 uptime

### Build failing?
- Check Node.js version (should be 20+)
- Verify `package.json` has correct build scripts
- Check Render build logs for specific errors

## Next Steps

1. ✅ Deploy to Render
2. ✅ Add environment variables via Dashboard
3. ✅ Monitor logs to verify bot is running
4. ⚠️ **REVOKE AND REGENERATE API KEYS** (they're exposed!)
5. ⚠️ **CHANGE MONGODB PASSWORD** (it's exposed!)

