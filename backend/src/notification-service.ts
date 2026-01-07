import axios from 'axios';
import { Alert } from './types';

export class NotificationService {
  private email?: string;
  private phone?: string;
  private webhookUrl?: string;
  private enabled: boolean;

  constructor() {
    this.email = process.env.NOTIFICATION_EMAIL;
    this.phone = process.env.NOTIFICATION_PHONE;
    this.webhookUrl = process.env.NOTIFICATION_WEBHOOK;
    this.enabled = process.env.NOTIFICATIONS_ENABLED === 'true';

    if (this.enabled) {
      console.log('📧 Notifications enabled');
      if (this.email) console.log(`  - Email: ${this.email}`);
      if (this.phone) console.log(`  - SMS: ${this.phone}`);
      if (this.webhookUrl) console.log(`  - Webhook configured`);
    }
  }

  async sendAlert(alert: Alert): Promise<void> {
    if (!this.enabled) return;

    // Only send high severity alerts to avoid spam
    if (alert.severity !== 'HIGH') return;

    const message = this.formatAlert(alert);

    // Send via all configured channels
    await Promise.all([
      this.sendEmail(message, alert),
      this.sendSMS(message, alert),
      this.sendWebhook(alert),
    ]);
  }

  private formatAlert(alert: Alert): string {
    return `🚨 ${alert.type}\n${alert.message}\n$${alert.amount?.toFixed(2) || 'N/A'}`;
  }

  private async sendEmail(message: string, alert: Alert): Promise<void> {
    if (!this.email) return;

    try {
      // Use a service like SendGrid, AWS SES, or Mailgun
      // Example with a webhook/API:
      console.log(`📧 Would send email to ${this.email}:`, message);
      
      // Uncomment and configure for actual email sending:
      // await axios.post('https://api.sendgrid.com/v3/mail/send', {
      //   personalizations: [{
      //     to: [{ email: this.email }],
      //     subject: `Polymarket Alert: ${alert.type}`,
      //   }],
      //   from: { email: 'alerts@yourapp.com' },
      //   content: [{
      //     type: 'text/plain',
      //     value: message,
      //   }],
      // }, {
      //   headers: {
      //     'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
      //   },
      // });
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  private async sendSMS(message: string, alert: Alert): Promise<void> {
    if (!this.phone) return;

    try {
      // Use Twilio or similar SMS service
      console.log(`📱 Would send SMS to ${this.phone}:`, message);
      
      // Uncomment and configure for actual SMS:
      // await axios.post('https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID/Messages.json', 
      //   new URLSearchParams({
      //     To: this.phone,
      //     From: process.env.TWILIO_PHONE_NUMBER!,
      //     Body: message.substring(0, 160), // SMS limit
      //   }), {
      //   auth: {
      //     username: process.env.TWILIO_ACCOUNT_SID!,
      //     password: process.env.TWILIO_AUTH_TOKEN!,
      //   },
      // });
    } catch (error) {
      console.error('Error sending SMS:', error);
    }
  }

  private async sendWebhook(alert: Alert): Promise<void> {
    if (!this.webhookUrl) return;

    try {
      // Send to Discord, Slack, or custom webhook
      await axios.post(this.webhookUrl, {
        content: this.formatAlert(alert),
        embeds: [{
          title: `${alert.type} Alert`,
          description: alert.message,
          color: alert.severity === 'HIGH' ? 0xFF0000 : 0xFFA500,
          fields: [
            { name: 'Amount', value: `$${alert.amount?.toFixed(2) || 'N/A'}`, inline: true },
            { name: 'Market', value: alert.market_id?.substring(0, 10) + '...', inline: true },
          ],
          timestamp: new Date(alert.timestamp).toISOString(),
        }],
      });
      console.log('✅ Webhook notification sent');
    } catch (error) {
      console.error('Error sending webhook:', error);
    }
  }
}
