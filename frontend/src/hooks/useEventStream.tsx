import React, { useEffect, useRef, useState, createContext, useContext, ReactNode } from "react";
import { useAuthStore } from "src/store/authStore";
import { useAlertStore } from "src/store/alertStore";
import { API_BASE_URL } from "src/lib/api";

type EventCallback = (event: any) => void;

interface EventStreamContextType {
  isConnected: boolean;
  subscribe: (eventType: string, callback: EventCallback) => () => void;
}

const EventStreamContext = createContext<EventStreamContextType | null>(null);

export function EventStreamProvider({ children }: { children: ReactNode }) {
  const { tenant } = useAuthStore();
  const { incrementUnreadCount } = useAlertStore();
  const [isConnected, setIsConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Record<string, Set<EventCallback>>>({});
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const subscribe = (eventType: string, callback: EventCallback) => {
    if (!listenersRef.current[eventType]) {
      listenersRef.current[eventType] = new Set();
    }
    listenersRef.current[eventType].add(callback);
    
    // Return unsubscribe function
    return () => {
      listenersRef.current[eventType]?.delete(callback);
    };
  };

  useEffect(() => {
    if (!tenant?.id) return;

    const connect = () => {
      if (wsRef.current) {
        wsRef.current.close();
      }

      // Convert HTTP url to WS/WSS
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      // Check if API_BASE_URL is relative or absolute
      let wsHost = "localhost:8000";
      if (API_BASE_URL.startsWith("http")) {
        try {
          const urlObj = new URL(API_BASE_URL);
          wsHost = urlObj.host;
        } catch (e) {
          wsHost = API_BASE_URL.replace(/^https?:\/\//, "").split('/')[0];
        }
      } else if (typeof window !== "undefined") {
        wsHost = window.location.host;
      }
      
      const wsUrl = `${wsProtocol}//${wsHost}/ws/stream/events?tenant_id=${tenant.id}`;
      
      console.log(`Connecting to WebSocket: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected successfully.");
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);
          const type = envelope.event_type || "message";
          const payload = envelope.payload || envelope;
          
          // Trigger global sound store increment if it is a threat alert
          if (payload?.threat?.is_threat || payload?.event_type?.includes("visual") || payload?.event_type?.includes("audio")) {
            incrementUnreadCount();
          }

          // Trigger registered callbacks
          if (listenersRef.current[type]) {
            listenersRef.current[type].forEach((cb) => cb(payload));
          }
          if (listenersRef.current["*"]) {
            listenersRef.current["*"].forEach((cb) => cb(payload));
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        
        // Attempt reconnect with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current += 1;
        console.log(`WebSocket closed. Reconnecting in ${delay}ms...`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = (err) => {
        console.error("WebSocket encountered an error:", err);
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        // Prevent reconnect loop on unmount
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [tenant?.id]);

  return (
    <EventStreamContext.Provider value={{ isConnected, subscribe }}>
      {children}
    </EventStreamContext.Provider>
  );
}

export function useEventStream() {
  const context = useContext(EventStreamContext);
  if (!context) {
    throw new Error("useEventStream must be used within an EventStreamProvider");
  }
  return context;
}
