# Binance API IP Whitelisting Guide

## Your EC2 IP Addresses

- **Public IP**: `3.91.27.124` ← **USE THIS FOR BINANCE WHITELIST**
- **Private IP**: `172.31.26.48` (not needed for Binance whitelisting)

## How to Whitelist Your EC2 IP in Binance

### Step-by-Step Instructions

1. **Log in to Binance Account**

   - Go to [Binance.com](https://www.binance.com) and log in

2. **Navigate to API Management**

   - Click on your profile icon (top right)
   - Go to **API Management** or visit: https://www.binance.com/en/my/settings/api-management

3. **Edit Your API Key**

   - Click on the API key you're using for this trading bot
   - Or create a new API key if needed

4. **Enable IP Whitelist Restriction**

   - Find the section: **"Restrict access to trusted IPs only"** or **"API Restrictions"**
   - Enable the IP whitelist option

5. **Add Your EC2 Public IP**

   - Click **"Add IP"** or **"Edit Restriction"**
   - **Try these formats (in order):**
     1. First try: `3.91.27.124` (without `/32`)
     2. If that fails, try: `3.91.27.124/32`
     3. If still failing, verify the IP is correct (see troubleshooting below)
   - Save the changes

6. **Verify**
   - After adding, Binance may require you to confirm via email or 2FA
   - Once confirmed, your API will only accept requests from this IP

## Important Notes

### ⚠️ Elastic IP vs Auto-Assigned Public IP

**If you're using Auto-Assigned Public IP** (default):

- The public IP **WILL CHANGE** if you stop and restart your EC2 instance
- You'll need to update the whitelist in Binance if the IP changes

**If you're using Elastic IP** (recommended for production):

- The public IP **WILL NOT CHANGE** even after stops/restarts
- More reliable for IP whitelisting

### How to Verify Your Actual Public IP

**From your EC2 instance, run:**

```bash
# Method 1: AWS metadata service (most accurate)
curl http://169.254.169.254/latest/meta-data/public-ipv4

# Method 2: External service
curl http://checkip.amazonaws.com

# Method 3: Check what external services see
curl http://icanhazip.com
```

**Important:** Compare all three results - they should match. If they don't, you might have network configuration issues.

### How to Check/Assign Elastic IP

```bash
# Check current public IP
curl http://169.254.169.254/latest/meta-data/public-ipv4

# In AWS Console:
# 1. EC2 Dashboard → Elastic IPs
# 2. Allocate Elastic IP address
# 3. Associate Elastic IP with your EC2 instance
```

### Testing After Whitelisting

After whitelisting, test your bot:

```bash
# Test from your EC2 instance
npm run dev

# Check logs for any IP-related errors
# You should see: "✅ Binance API client initialized with credentials"
```

### Common Issues

**"Verification failed" error (⚠️ You're experiencing this):**
This usually means one of the following:

1. **Try IP without `/32` suffix:**

   - Binance sometimes doesn't accept `/32` for single IPs
   - Try just: `3.91.27.124` (without the `/32`)

2. **Verify the actual public IP:**

   - The IP might have changed or you might have the wrong one
   - Run this on your EC2 instance to check:
     ```bash
     curl http://checkip.amazonaws.com
     curl http://169.254.169.254/latest/meta-data/public-ipv4
     ```
   - Compare with what Binance sees (check your Binance login history/security logs)

3. **Check for NAT Gateway:**

   - If your EC2 is behind a NAT Gateway, you need to whitelist the NAT Gateway's public IP, not the EC2 instance IP
   - Check your VPC/Subnet configuration in AWS

4. **Account verification requirement:**

   - Some Binance accounts require KYC verification before enabling IP whitelisting
   - Ensure your account is verified

5. **Try CIDR range instead:**
   - If single IP fails, try: `3.91.27.0/24` (but this is less secure as it allows a range)

**"IP not whitelisted" error:**

- Verify you added the correct public IP
- Check if the IP changed (if not using Elastic IP)
- Wait a few minutes after adding - changes may take time to propagate

**"Invalid IP format" error:**

- Try format: `3.91.27.124` (without `/32`)
- Or try: `3.91.27.124/32`
- Make sure there are no extra spaces or characters

**Can't connect from local machine:**

- If you're developing locally, you'll need to either:
  - Add your local machine's public IP to the whitelist
  - Temporarily disable IP restrictions for testing (NOT RECOMMENDED)
  - Use SSH port forwarding to test from EC2

## Security Best Practices

1. ✅ **Always use IP whitelisting** - Limits API access to your EC2 instance only
2. ✅ **Use Elastic IP** - Prevents IP changes from breaking your whitelist
3. ✅ **Restrict API permissions** - Only enable what you need (e.g., "Enable Spot & Margin Trading")
4. ✅ **Never share API keys** - Keep them in environment variables or secrets management
5. ✅ **Monitor API usage** - Check Binance API logs regularly for unauthorized access

## Current Configuration

Your trading bot uses the Binance API through:

- **File**: `src/services/binanceService.ts`
- **Environment Variables**: `BINANCE_API_KEY` and `BINANCE_API_SECRET`
- **Public IP to Whitelist**: `3.91.27.124/32`
