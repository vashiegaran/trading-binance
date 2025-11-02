# Fly.io Deployment Guide

This guide will help you deploy the Binance Trading Bot to Fly.io.

---

## Prerequisites

1. **Fly.io Account**: Sign up at [fly.io](https://fly.io)
2. **Fly CLI**: Install the Fly CLI

   ```bash
   # macOS
   curl -L https://fly.io/install.sh | sh

   # OR using Homebrew
   brew install flyctl
   ```

3. **Docker** (optional, for local testing):
   ```bash
   # macOS
   brew install docker
   ```

---

## Step 1: Login to Fly.io

```bash
fly auth login
```

This will open your browser to authenticate.

---

## Step 2: Initialize Fly.io App

```bash
fly launch
```

**During setup:**

- App name: `trading-binance-bot` (or choose your own)
- Region: Choose closest to you (e.g., `iad` for US East)
- PostgreSQL: **No** (we're using MongoDB separately)
- Redis: **No**

This will create `fly.toml` if it doesn't exist.

---

## Step 3: Set Environment Variables

**Non-sensitive variables are already in `fly.toml`** (like `TRADE_AMOUNT_USDT`, `MIN_CONFIDENCE`, etc.)

**Only set sensitive secrets** using `fly secrets set`:

```bash
# Binance API Credentials (SENSITIVE - use secrets)
fly secrets set BINANCE_API_KEY=your_api_key_here
fly secrets set BINANCE_API_SECRET=your_api_secret_here

# MongoDB Configuration (SENSITIVE - use secrets)
fly secrets set MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trading_bot
```

**To override non-sensitive variables**, edit `fly.toml` `[env]` section or set as secrets:

```bash
# Optional: Override defaults from fly.toml if needed
fly secrets set TRADE_AMOUNT_USDT=20
fly secrets set MIN_CONFIDENCE=70
```

**Important**:

- Sensitive data (API keys, MongoDB URI) should use `fly secrets set`
- Non-sensitive configs are in `fly.toml` `[env]` section
- Secrets take precedence over `[env]` values

---

## Step 4: Deploy

```bash
fly deploy
```

This will:

1. Build the Docker image
2. Push to Fly.io
3. Deploy your app
4. Start the bot

---

## Step 5: Verify Deployment

### Check App Status

```bash
fly status
```

### View Logs

```bash
fly logs
```

### Check Specific Process

```bash
fly logs -a trading-binance-bot
```

---

## Step 6: Monitor Your Bot

### Real-time Logs

```bash
fly logs -a trading-binance-bot --follow
```

### SSH into App (for debugging)

```bash
fly ssh console -a trading-binance-bot
```

### Check Metrics

```bash
fly metrics -a trading-binance-bot
```

---

## Configuration Options

### Scale Resources (if needed)

```bash
# Scale memory/CPU
fly scale vm shared-cpu-2x --memory 1024 -a trading-binance-bot
```

### Auto-restart Settings

The `fly.toml` is configured with:

- `auto_stop_machines = false` - Keeps bot running 24/7
- `auto_start_machines = true` - Auto-starts if stopped
- `min_machines_running = 1` - Always keeps 1 machine running

### Change Region

```bash
fly regions set iad -a trading-binance-bot
```

---

## Health Check Endpoint

The bot includes a health check endpoint (optional). You can add this to `src/index.ts`:

```typescript
import express from "express";

const app = express();
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT);
```

---

## Important Notes

### 1. **Keep the Bot Running**

- The bot needs to run continuously for cron jobs
- `fly.toml` is configured to keep it running 24/7
- Costs ~$5-10/month for basic plan

### 2. **MongoDB Setup**

- Use MongoDB Atlas (free tier available)
- Set `MONGODB_URI` via `fly secrets set`
- The bot will connect automatically

### 3. **Logs Persistence**

- Logs are saved in container (`/app/logs`)
- Use `fly logs` to view them
- Consider external logging service for long-term storage

### 4. **Cron Jobs**

- Runs hourly using `node-cron`
- First run happens immediately on startup
- Then runs every hour at minute 0

### 5. **Cost Management**

- Free tier: Limited hours/month
- Paid: ~$5-10/month for always-on
- Monitor usage: `fly dashboard`

---

## Troubleshooting

### Bot Not Running

```bash
# Check status
fly status -a trading-binance-bot

# View logs
fly logs -a trading-binance-bot

# Restart
fly apps restart trading-binance-bot
```

### Connection Issues

```bash
# Check if MongoDB URI is set
fly secrets list -a trading-binance-bot

# Test connection (SSH in)
fly ssh console -a trading-binance-bot
# Then: node -e "console.log(process.env.MONGODB_URI)"
```

### Build Failures

```bash
# Build locally to test
docker build -t trading-bot .

# Test locally
docker run --env-file .env trading-bot
```

---

## Useful Commands

```bash
# Deploy new version
fly deploy

# View logs
fly logs -a trading-binance-bot

# SSH into app
fly ssh console -a trading-binance-bot

# Check status
fly status -a trading-binance-bot

# Scale resources
fly scale vm shared-cpu-1x --memory 512 -a trading-binance-bot

# Update secrets
fly secrets set KEY=value -a trading-binance-bot

# List secrets (keys only, not values)
fly secrets list -a trading-binance-bot

# Remove app
fly apps destroy trading-binance-bot
```

---

## Deployment Checklist

- [ ] Fly.io account created
- [ ] Fly CLI installed
- [ ] Logged in (`fly auth login`)
- [ ] App initialized (`fly launch`)
- [ ] Environment variables set (`fly secrets set`)
- [ ] MongoDB Atlas configured (or local MongoDB accessible)
- [ ] Deployed (`fly deploy`)
- [ ] Logs verified (`fly logs`)
- [ ] Bot is running (`fly status`)

---

## Security Best Practices

1. **Never commit secrets** - Use `fly secrets set`
2. **IP Whitelist** - Restrict MongoDB Atlas to Fly.io IPs (if possible)
3. **API Key Permissions** - Use minimal required permissions
4. **Regular Updates** - Keep dependencies updated
5. **Monitor Logs** - Check logs regularly for issues

---

## Cost Estimation

- **Basic Plan**: ~$5-10/month for always-on single instance
- **Free Tier**: Limited to 3 shared-cpu-1x with 256MB machines
- **MongoDB Atlas**: Free tier available (512MB storage)

---

## Next Steps After Deployment

1. ✅ Monitor logs for first few hours
2. ✅ Verify trades are being saved to MongoDB
3. ✅ Check bot is running hourly
4. ✅ Set up alerts/monitoring (optional)
5. ✅ Connect Next.js dashboard to same MongoDB

---

**Your bot is now running on Fly.io!** 🚀
