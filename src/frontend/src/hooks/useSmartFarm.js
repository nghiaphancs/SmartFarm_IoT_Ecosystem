/**
 * Custom WebSocket hook – connects to backend and dispatches realtime updates.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = 'ws://localhost:8000/ws';

export function useSmartFarm() {
  const [sensors, setSensors] = useState({ temperature: null, humidity: null, soil: null, lux: null });
  const [devices, setDevices] = useState({ led: 0, pump: 0, auto_led: 0, auto_pump: 0 });
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState({ temperature: [], humidity: [], soil: [], lux: [] });

  const wsRef = useRef(null);

  const appendHistory = useCallback((key, value) => {
    setHistory(h => ({
      ...h,
      [key]: [...h[key].slice(-29), { time: new Date().toLocaleTimeString(), value: parseFloat(value) }]
    }));
  }, []);

  useEffect(() => {
    let reconnectTimer;

    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'init') {
          setSensors(msg.sensors);
          setDevices(msg.devices);
          setAlerts(msg.alerts || []);
          if (msg.history) {
            setHistory(msg.history);
          } else {
            // fallback: seed history with current values if no history provided
            Object.entries(msg.sensors).forEach(([k, v]) => {
              if (v !== null) appendHistory(k, v);
            });
          }
        } else if (msg.type === 'sensor') {
          setSensors(s => ({ ...s, [msg.key]: msg.value }));
          appendHistory(msg.key, msg.value);
        } else if (msg.type === 'device') {
          setDevices(d => ({ ...d, [msg.key]: msg.value }));
        } else if (msg.type === 'alert') {
          setAlerts(a => [...a.slice(-49), { type: msg.key, value: msg.value, time: new Date().toLocaleTimeString() }]);
        }
      };
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [appendHistory]);

  // REST control helper
  const control = useCallback(async (device, value) => {
    try {
      const res = await fetch('http://localhost:8000/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device, value }),
      });
      if (!res.ok) throw new Error('Control failed');
      setDevices(d => ({ ...d, [device]: value }));
    } catch (err) {
      console.error(err);
    }
  }, []);

  return { sensors, devices, alerts, connected, history, control };
}
