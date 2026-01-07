import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface NotificationSettings {
  email: string;
  phone: string;
  webhookUrl: string;
  enabled: boolean;
}

export function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>({
    email: '',
    phone: '',
    webhookUrl: '',
    enabled: false,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch(`${API_BASE}/notifications/settings`);
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSave = async () => {
    try {
      await fetch(`${API_BASE}/notifications/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <h2 className="text-xl font-bold mb-4">🔔 Notification Settings</h2>
      
      <div className="space-y-4">
        <div>
          <label className="flex items-center space-x-2 mb-2">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              className="rounded bg-gray-700 border-gray-600"
            />
            <span className="text-sm font-medium">Enable Notifications</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Email Address
          </label>
          <input
            type="email"
            value={settings.email}
            onChange={(e) => setSettings({ ...settings, email: e.target.value })}
            placeholder="your@email.com"
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">
            Add to .env: NOTIFICATION_EMAIL=your@email.com
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Phone Number (SMS)
          </label>
          <input
            type="tel"
            value={settings.phone}
            onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
            placeholder="+1234567890"
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">
            Add to .env: NOTIFICATION_PHONE=+1234567890
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Webhook URL (Discord/Slack)
          </label>
          <input
            type="url"
            value={settings.webhookUrl}
            onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
            placeholder="https://discord.com/api/webhooks/..."
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">
            Add to .env: NOTIFICATION_WEBHOOK=https://...
          </p>
        </div>

        <div className="pt-4">
          <button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors"
          >
            Save Settings
          </button>
          {saved && (
            <span className="ml-3 text-green-400 text-sm">✓ Saved! (Add to .env file)</span>
          )}
        </div>

        <div className="bg-gray-900 rounded p-4 mt-4">
          <h3 className="text-sm font-bold mb-2">📝 Setup Instructions</h3>
          <ol className="text-xs text-gray-300 space-y-2 list-decimal list-inside">
            <li>Add the variables above to your <code className="bg-gray-800 px-1 rounded">.env</code> file</li>
            <li>Set <code className="bg-gray-800 px-1 rounded">NOTIFICATIONS_ENABLED=true</code></li>
            <li>For email: Configure SendGrid API key</li>
            <li>For SMS: Set up Twilio credentials</li>
            <li>For Discord: Create a webhook in your server settings</li>
            <li>Restart the backend server to apply changes</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
