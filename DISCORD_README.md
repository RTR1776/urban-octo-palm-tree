# 🐋 Polymarket Whale Monitor

Welcome to the Polymarket Whale Monitor! This bot tracks large and unusual trading activity on Polymarket in real-time and alerts you when something interesting happens.

---

## 🎯 What Does It Do?

The bot monitors **every trade** on Polymarket and uses a smart scoring system to identify:
- 🐋 **Large trades** from whales
- 🆕 **New wallets** making big moves
- 📚 **Book walks** (trades so large they eat through multiple price levels)
- 🕸️ **Coordinated activity** (multiple wallets trading together)
- 📈 **Price impact** events
- ↩️ **Reversions** (when a big move gets undone quickly)

---

## 📊 Understanding the Alerts

### Alert Types

| Emoji | Type | What It Means |
|-------|------|---------------|
| 💰 | **LARGE_TRADE** | A trade significantly larger than normal for that market |
| 🐋 | **WHALE_TRADE** | A trade from a known whale wallet |
| 🆕🐋 | **NEW_WHALE** | A new wallet making their first big trade |
| 📚 | **BOOK_WALKED** | Trade was so large it filled orders at multiple price levels |
| 📈 | **PRICE_IMPACT** | Trade caused noticeable price movement |
| 🕸️ | **COORDINATED_CLUSTER** | Multiple wallets trading the same direction within seconds |
| ↩️ | **REVERSION** | A big price move that reversed quickly (possible manipulation) |
| 📦 | **STACKING** | Same wallet making repeated trades (building a position) |

### Trade Side Indicators
- 🟢 **BUY** - Someone is buying YES shares (betting something WILL happen)
- 🔴 **SELL** - Someone is selling YES shares (betting something WON'T happen)

---

## 🔢 The Scoring System (0-100)

Every event gets a **severity score** based on multiple factors:

| Factor | What It Measures |
|--------|------------------|
| 💵 **Size** | Raw dollar value of the trade |
| 📊 **Vol%** | Trade size vs. market's 24h volume |
| 📏 **Median** | How many times larger than the typical trade |
| 📈 **Impact** | How much the price moved |
| 📚 **Walked** | How many price levels the trade ate through |
| 👛 **Wallet** | Is this a known whale? New wallet? |
| 🕸️ **Cluster** | Is this part of coordinated activity? |

### Score Tiers

| Score | Alert Level | What You'll See |
|-------|-------------|-----------------|
| **65+** | 🚨 CRITICAL | @everyone ping - something major is happening |
| **45-64** | ⚠️ HIGH | Individual alert with full details |
| **25-44** | 📊 DIGEST | Batched into periodic summaries |
| **<25** | 📝 Stored | Logged but not sent (routine activity) |

---

## 📬 Alert Formats

### Individual Alerts (High/Critical)
```
📚 BOOK_WALKED (Score: 52)
🟢 BUY $15,420
📊 💵 Size +15 • 📈 Impact +18 • 📚 Walked +12
> Book walked 5 levels on large trade
```

### Activity Digest
Every few minutes, you'll get a summary of medium-priority events:
```
📊 Activity Digest (12 events in 5 min)
━━━━━━━━━━━━━━━━━━━━━━

💰 LARGE_TRADE [38] 🟢 BUY $5,230 @ 0.650
   └ 💵 Size +7 • 📊 Vol% +12 • 📏 8x median
   └ Will Trump win the 2024 election?

📚 BOOK_WALKED [35] 🔴 SELL $3,100 @ 0.420
   └ 📈 Impact +10 • 📚 Walked +8
   └ Will Bitcoin hit $100k?
...
```

---

## 🔍 How to Use This Info

### Bullish Signals 🟢
- Large **BUY** orders from known whales
- Multiple wallets buying the same market (coordinated bullish)
- New whales entering with big BUY positions

### Bearish Signals 🔴
- Large **SELL** orders from whales
- Book walks on the SELL side
- Coordinated SELL activity

### Caution Signs ⚠️
- **Reversions** - Could indicate manipulation or stop hunts
- **New wallets** with huge trades - Could be informed money OR manipulation
- **Coordinated clusters** - Could be organic OR coordinated pump/dump

---

## 🌐 Web Dashboard

View real-time data and historical activity at:
**https://frontend-six-iota-25.vercel.app**

Features:
- 📈 Top Markets by volume
- 🐋 Top Traders (recent activity)
- 💰 Largest Trades
- 🔔 Alert History
- 📊 Market Stats

---

## ⚙️ Technical Details

- **Data Source**: Polymarket Public Data API
- **Update Frequency**: Every 60 seconds
- **Scoring**: Multi-factor severity algorithm (0-100)
- **Hosting**: Fly.io (backend) + Vercel (dashboard)

---

## 📝 Notes

- All dollar amounts are in **USDC** (1 USDC ≈ $1 USD)
- Wallet addresses are shortened (e.g., `0x1234...5678`)
- Times are shown in your local timezone
- The bot does NOT provide financial advice - it just reports what's happening

---

**Happy trading! 🐋📈**

*Questions or issues? Let me know in the channel.*
