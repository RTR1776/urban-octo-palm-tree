# 🔔 Notification Setup Guide

Your whale monitoring bot can now send real-time alerts via email, SMS, or webhooks (Discord/Slack)!

## Quick Setup

### 1. Enable Notifications

Add to your `backend/.env` file:
```bash
NOTIFICATIONS_ENABLED=true
```

### 2. Choose Your Notification Method

## 📧 Email Notifications (SendGrid)

1. Sign up for free at https://sendgrid.com (100 emails/day free)
2. Create an API key in Settings → API Keys
3. Add to `.env`:
```bash
NOTIFICATION_EMAIL=your@email.com
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
```

4. Uncomment the SendGrid code in `backend/src/notification-service.ts` (lines ~35-48)

## 📱 SMS Notifications (Twilio)

1. Sign up at https://www.twilio.com/try-twilio (free trial credits)
2. Get a phone number from the console
3. Find your Account SID and Auth Token
4. Add to `.env`:
```bash
NOTIFICATION_PHONE=+1234567890
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
```

5. Uncomment the Twilio code in `backend/src/notification-service.ts` (lines ~56-70)

## 💬 Discord Webhook

1. In your Discord server, go to: Server Settings → Integrations → Webhooks
2. Click "New Webhook"
3. Copy the webhook URL
4. Add to `.env`:
```bash
NOTIFICATION_WEBHOOK=https://discord.com/api/webhooks/123456789/abcdefg
```

**This works immediately - no code changes needed!**

## 📊 Slack Webhook

1. Create a Slack app: https://api.slack.com/apps
2. Enable "Incoming Webhooks"
3. Add webhook to workspace
4. Copy the webhook URL
5. Add to `.env`:
```bash
NOTIFICATION_WEBHOOK=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX
```

## What Gets Notified?

By default, only **HIGH severity** alerts are sent to avoid spam:

✅ **NEW_WHALE** alerts (new large trader detected)
✅ **Large trades** over whale threshold ($10,000+)

To change this, edit `backend/src/notification-service.ts` line 24:
```typescript
if (alert.severity !== 'HIGH') return; // Change to 'MEDIUM' for more alerts
```

## Testing

1. Set `WHALE_THRESHOLD=100` in `.env` for testing (lower threshold)
2. Restart the bot
3. Wait for trades to be detected
4. Check your email/phone/Discord!

## Customization

Edit `backend/src/notification-service.ts` to:
- Change message formatting
- Add more notification services
- Filter which types of alerts get sent
- Add rate limiting

## Troubleshooting

**Not receiving notifications?**
- Check `NOTIFICATIONS_ENABLED=true` is set
- Verify your API keys are correct
- Look for error messages in the backend console
- Make sure you've uncommented the relevant code sections

**Too many notifications?**
- Increase `WHALE_THRESHOLD` in `.env`
- Change severity filter to 'HIGH' only
- Add rate limiting in the notification service

**Discord webhook not working?**
- Verify the webhook URL is complete and correct
- Check your Discord server permissions
- Look for 400/401 errors in console

## Cost

- **Discord/Slack webhooks**: FREE ✅
- **SendGrid**: 100 emails/day FREE, then ~$15/month
- **Twilio SMS**: ~$0.0075 per SMS (trial credits available)

## Recommended Setup

For most users, start with **Discord webhook** - it's free, instant, and no API keys needed!

Just:
1. Create webhook in Discord
2. Add URL to `NOTIFICATION_WEBHOOK=...`
3. Set `NOTIFICATIONS_ENABLED=true`
4. Restart bot

Done! 🎉
