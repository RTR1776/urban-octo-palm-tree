import { useEffect, useRef, useState } from 'react';
import { Alert, Trade, WhaleActivity } from './types';

interface WebSocketMessage {
  type: string;
  data: any;
}

// Get WebSocket URL from API URL or fallback to current host
const getWsUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    // Convert https://xxx.fly.dev/api to wss://xxx.fly.dev/ws
    const wsUrl = apiUrl.replace(/^http/, 'ws').replace(/\/api$/, '/ws');
    return wsUrl;
  }
  // Fallback for local dev
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
};

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [whales, setWhales] = useState<WhaleActivity[]>([]);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const wsUrl = getWsUrl();
    console.log('Connecting to WebSocket:', wsUrl);

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.current.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const handleMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'initial_data':
        setAlerts(message.data.alerts || []);
        setWhales(message.data.whales || []);
        setTrades(message.data.trades || []);
        break;

      case 'new_alert':
        setAlerts((prev) => [message.data, ...prev].slice(0, 100));
        break;

      case 'new_trade':
        setTrades((prev) => [message.data, ...prev].slice(0, 100));
        break;

      case 'whale_activity_update':
        setWhales((prev) => {
          const existing = prev.findIndex(
            (w) =>
              w.trader_address === message.data.trader_address &&
              w.market_id === message.data.market_id
          );
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = message.data;
            return updated;
          }
          return [message.data, ...prev].slice(0, 100);
        });
        break;

      case 'alerts':
        setAlerts(message.data);
        break;

      case 'whale_activity':
        setWhales(message.data);
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const sendMessage = (message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  const markAlertAsRead = (alertId: number) => {
    sendMessage({ type: 'mark_alert_read', alertId });
  };

  return {
    connected,
    alerts,
    trades,
    whales,
    sendMessage,
    markAlertAsRead,
  };
}
