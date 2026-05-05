/**
 * Custom hook – connects to the monitoring WebSocket and dispatches real-time updates.
 * Also exposes REST control helper (actuating module).
 *
 * Updated to use new microservice endpoints via services/api.js
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { WS_URL, actuatingApi } from '../services/api';

export function useSmartFarm() {
  const [sensors, setSensors] = useState({ temperature: null, humidity: null, soil: null, lux: null });
  const [devices, setDevices] = useState({ led: 0, pump: 0, auto_led: 0, auto_pump: 0 });
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState({ temperature: [], humidity: [], soil: [], lux: [] });
  const [thresholds, setThresholds] = useState({ threshold_temp: 35, threshold_humidity: 30, threshold_soil: 20, threshold_lux: 10 });

  const wsRef = useRef(null);

  const appendHistory = useCallback((key, value) => {
    setHistory(h => ({
      ...h,
      [key]: [...h[key].slice(-29), { time: new Date().toLocaleTimeString(), value: parseFloat(value) }],
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
          if (msg.thresholds) {
            setThresholds(msg.thresholds);
          }
          if (msg.history) {
            setHistory(msg.history);
          } else {
            Object.entries(msg.sensors).forEach(([k, v]) => {
              if (v !== null) appendHistory(k, v);
            });
          }
        } else if (msg.type === 'sensor') {
          setSensors(s => ({ ...s, [msg.key]: msg.value }));
          appendHistory(msg.key, msg.value);
        } else if (msg.type === 'device') {
          setDevices(d => ({ ...d, [msg.key]: msg.value }));
        } else if (msg.type === 'threshold') {
          setThresholds(t => ({ ...t, [msg.key]: msg.value }));
        } else if (msg.type === 'alert') {
          setAlerts(a => [
            ...a.slice(-49),
            { type: msg.key, value: msg.value, time: new Date().toLocaleTimeString() },
          ]);
        }
      };
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [appendHistory]);

  // UC_Actuating_2: Điều khiển thiết bị – calls /api/actuating/control
  const control = useCallback(async (device, value) => {
    try {
      await actuatingApi.control(device, value);
      setDevices(d => ({ ...d, [device]: value }));
    } catch (err) {
      console.error('Control failed:', err.message);
    }
  }, []);

  return { sensors, devices, alerts, connected, history, control, thresholds };
}
