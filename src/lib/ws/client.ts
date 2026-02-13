import { config } from '@/lib/config';
import { useWSStore } from '@/store';

type MessageHandler = (data: unknown) => void;

class DeepSeerWebSocket {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseDelay = 1000;

  private resolveWsUrl(): string {
    if (config.wsApiUrl) {
      return config.wsApiUrl;
    }

    if (config.apiUrl) {
      try {
        const apiUrl = new URL(config.apiUrl);
        const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${apiUrl.host}`;
      } catch {
        // Ignore invalid API URL and continue to runtime fallback.
      }
    }

    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.hostname}:4000`;
    }

    return '';
  }

  connect() {
    const wsUrl = this.resolveWsUrl();
    if (!wsUrl) {
      useWSStore.getState().setError('WebSocket API URL not configured (NEXT_PUBLIC_WS_API_URL).');
      return;
    }

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        useWSStore.getState().setConnected(true);
        useWSStore.getState().setError(null);
      };

      this.ws.onmessage = (event) => {
        useWSStore.getState().setLastMessage(Date.now());
        try {
          const data = JSON.parse(event.data);
          const { type, payload } = data;
          if (type && this.handlers.has(type)) {
            this.handlers.get(type)!.forEach((handler) => handler(payload));
          }
        } catch {
          // Non-JSON message — ignore
        }
      };

      this.ws.onclose = () => {
        useWSStore.getState().setConnected(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        useWSStore.getState().setError('WebSocket connection error.');
      };
    } catch {
      useWSStore.getState().setError('Failed to establish WebSocket connection.');
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      useWSStore.getState().setError('WebSocket reconnection failed after maximum attempts.');
      return;
    }
    useWSStore.getState().setReconnecting(true);
    const delay = this.baseDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  subscribe(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.ws?.close();
    this.ws = null;
    useWSStore.getState().setConnected(false);
  }
}

// Singleton
export const wsClient = new DeepSeerWebSocket();
