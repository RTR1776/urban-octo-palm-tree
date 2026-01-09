import { useEffect, useRef, useState, useCallback } from 'react';
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

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [whales, setWhales] = useState<WhaleActivity[]>([]);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  // Fallback: Load data via REST API
  const loadDataViaRest = useCallback(async () => {
    try {
      const [tradesRes, whalesRes] = await Promise.all([
        fetch(`${API_BASE}/trades/recent?limit=50`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/whales?limit=50`).then(r => r.ok ? r.json() : []),
      ]);
      setTrades(tradesRes || []);
      setWhales(whalesRes || []);
    } catch (error) {
      console.error('Error loading data via REST:', error);
    }
  }, []);

  const connect = useCallback(() => {
    const wsUrl = getWsUrl();
    console.log('Connecting to WebSocket:', wsUrl);

    try {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.current.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        setConnected(false);
        
        // Auto-reconnect with exponential backoff (max 30 seconds)
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;
        
        console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
        reconnectTimeout.current = setTimeout(connect, delay);
        
        // Also load data via REST as fallback
        loadDataViaRest();
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
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      // Fallback to REST
      loadDataViaRest();
    }
  }, [loadDataViaRest]);

  useEffect(() => {
    connect();
    
    // Also load initial data via REST as a backup
    loadDataViaRest();
    
    // Periodically refresh data via REST (every 30 seconds)
    const refreshInterval = setInterval(loadDataViaRest, 30000);

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
      clearInterval(refreshInterval);
    };
  }, [connect, loadDataViaRest]);

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
