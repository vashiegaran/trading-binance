# Fly.io Deployment Checklist

Quick checklist for deploying to Fly.io:

## Pre-Deployment

- [ ] Fly.io account created at https://fly.io
- [ ] Fly CLI installed (`brew install flyctl` or via install script)
- [ ] MongoDB Atlas account (or local MongoDB accessible)
- [ ] Binance API keys ready

## Deployment Steps

1. [ ] Login to Fly.io: `fly auth login`
2. [ ] Initialize app: `fly launch` (or use existing `fly.toml`)
3. [ ] Set secrets:
   ```bash
   fly secrets set BINANCE_API_KEY=your_key
   fly secrets set BINANCE_API_SECRET=your_secret
   fly secrets set MONGODB_URI=your_mongodb_uri
   fly secrets set MONGODB_DB_NAME=trading_bot
   fly secrets set TRADE_AMOUNT_USDT=10
   fly secrets set MIN_CONFIDENCE=60
   fly secrets set USE_MARKET_ORDERS=true
   fly secrets set LOG_LEVEL=info
   ```
4. [ ] Deploy: `fly deploy`
5. [ ] Check status: `fly status`
6. [ ] View logs: `fly logs`

## Post-Deployment

- [ ] Verify bot is running: `fly status`
- [ ] Check logs for successful MongoDB connection
- [ ] Verify health check: `fly logs | grep health`
- [ ] Monitor for first hour to ensure cron job runs
- [ ] Verify trades are being saved to MongoDB

## Troubleshooting

- **Build fails**: Check Dockerfile and package.json
- **Connection issues**: Verify MongoDB URI in secrets
- **Bot not starting**: Check logs with `fly logs`
- **Restart bot**: `fly apps restart trading-binance-bot`

---

**Ready to deploy? Run `fly deploy` after setting secrets!**

