import WebSocket from 'ws';
import { Server } from 'http';
import { DatabaseService } from './database';

export class WebSocketServer {
  private wss: WebSocket.Server;
  private clients: Set<WebSocket>;
  private db: DatabaseService;

  constructor(server: Server, db: DatabaseService) {
    this.wss = new WebSocket.Server({ server, path: '/ws' });
    this.clients = new Set();
    this.db = db;
    this.initialize();
  }

  private initialize(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('Client connected to WebSocket');
      this.clients.add(ws);

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected from WebSocket');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });

      this.sendInitialData(ws);
    });
  }

  private sendInitialData(ws: WebSocket): void {
    const recentAlerts = this.db.getRecentAlerts(20);
    const whaleActivity = this.db.getWhaleActivity(20);
    const recentTrades = this.db.getRecentTrades(50);

    ws.send(JSON.stringify({
      type: 'initial_data',
      data: {
        alerts: recentAlerts,
        whales: whaleActivity,
        trades: recentTrades,
      },
    }));
  }

  private handleMessage(ws: WebSocket, data: any): void {
    switch (data.type) {
      case 'mark_alert_read':
        if (data.alertId) {
          this.db.markAlertAsRead(data.alertId);
        }
        break;
      case 'get_whale_activity':
        const whales = this.db.getWhaleActivity(100);
        ws.send(JSON.stringify({ type: 'whale_activity', data: whales }));
        break;
      case 'get_alerts':
        const alerts = this.db.getRecentAlerts(100);
        ws.send(JSON.stringify({ type: 'alerts', data: alerts }));
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  broadcastAlert(alert: any): void {
    const message = JSON.stringify({
      type: 'new_alert',
      data: alert,
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  broadcastTrade(trade: any): void {
    const message = JSON.stringify({
      type: 'new_trade',
      data: trade,
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  broadcastWhaleActivity(activity: any): void {
    const message = JSON.stringify({
      type: 'whale_activity_update',
      data: activity,
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}
