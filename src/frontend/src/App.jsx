import { useState, useEffect, useRef } from 'react';
import { useSmartFarm } from './hooks/useSmartFarm';
import SensorCard from './components/SensorCard';
import SensorChart from './components/SensorChart';
import ControlPanel from './components/ControlPanel';

import WateringPrediction from './pages/WateringPrediction';
import LoginPage from './pages/Auth/LoginPage';
import AdminDashboard from './pages/Admin/AdminDashboard';
import SettingsMenu from './components/SettingsMenu';
import { authApi } from './services/api';

const NAV = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'control', icon: '🎛️', label: 'Control' },
  { id: 'predict', icon: '🌱', label: 'Prediction' },
];

function Sidebar({ page, setPage }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">🌱</div>
        <div>
          <h1>SmartFarm</h1>
          <span>IoT Ecosystem</span>
        </div>
      </div>
      {NAV.map(n => (
        <div
          key={n.id}
          className={`nav-item${page === n.id ? ' active' : ''}`}
          onClick={() => setPage(n.id)}
          role="button"
        >
          <span style={{ fontSize: 18 }}>{n.icon}</span>
          {n.label}
        </div>
      ))}
    </nav>
  );
}

function WsBadge({ connected }) {
  return (
    <div className={`ws-badge ${connected ? 'connected' : 'disconnected'}`}>
      <span className="dot" />
      {connected ? 'Live' : 'No Connection'}
    </div>
  );
}

function FarmerShell({ onLogout }) {
  const [page, setPage] = useState('dashboard');
  const { sensors, devices, alerts, connected, history, control, thresholds } = useSmartFarm();

  // ── Smart Alert: Phát hiện sự cố máy bơm ──────────────────────────────────
  const [pumpIssue, setPumpIssue] = useState(false);
  const pumpTimerRef = useRef(null);
  const startMoistureRef = useRef(null);

  useEffect(() => {
    if (devices.pump === 1) {
      if (!pumpTimerRef.current) {
        pumpTimerRef.current = Date.now();
        startMoistureRef.current = sensors.soil;
      } else {
        const elapsedSecs = (Date.now() - pumpTimerRef.current) / 1000;
        // Nếu bơm chạy > 30s mà độ ẩm không tăng (demo 30s thay vì 5p để dễ thấy)
        if (elapsedSecs > 30 && sensors.soil <= startMoistureRef.current) {
          setPumpIssue(true);
        } else if (sensors.soil > startMoistureRef.current) {
          setPumpIssue(false); // Đã tăng -> ổn
        }
      }
    } else {
      pumpTimerRef.current = null;
      startMoistureRef.current = null;
      setPumpIssue(false);
    }
  }, [devices.pump, sensors.soil]);

  const isDaytime = () => {
    const hr = new Date().getHours();
    return hr >= 6 && hr <= 18;
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return (
          <div className="dashboard-layout">
            {pumpIssue && (
              <div className="smart-alert-banner">
                ⚠️ <strong>CẢNH BÁO SỰ CỐ:</strong> Máy bơm đang chạy nhưng độ ẩm đất không tăng. 
                Vui lòng kiểm tra ống dẫn nước hoặc bồn chứa!
              </div>
            )}
            
            <section className="dashboard-top">
              <div className="grid-4">
                <SensorCard 
                  type="temp" label="Temperature" value={sensors.temperature} unit="°C" icon="🌡️" 
                  isAlert={sensors.temperature > thresholds.threshold_temp || (sensors.temperature !== null && sensors.temperature < 15)} 
                  alertMsg={sensors.temperature > thresholds.threshold_temp ? `High Temp (>${thresholds.threshold_temp}°C)` : "Low Temp (<15°C)"}
                />
                <SensorCard 
                  type="humidity" label="Air Humidity" value={sensors.humidity} unit="%" icon="💧" 
                  isAlert={sensors.humidity !== null && sensors.humidity < thresholds.threshold_humidity}
                  alertMsg={`Dry Air (<${thresholds.threshold_humidity}%)`}
                />
                <SensorCard 
                  type="soil" label="Soil Moisture" value={sensors.soil} unit="%" icon="🌱" 
                  isAlert={sensors.soil !== null && (sensors.soil < thresholds.threshold_soil || pumpIssue)} 
                  alertMsg={pumpIssue ? "Pump Malfunction" : `Extremely Dry (<${thresholds.threshold_soil}%)`}
                />
                <SensorCard 
                  type="lux" label="Light" value={sensors.lux} unit="%" icon="☀️" 
                  isAlert={isDaytime() && sensors.lux !== null && sensors.lux < thresholds.threshold_lux} 
                  alertMsg="Abnormal Dark Day"
                />
              </div>
            </section>

            <section className="dashboard-charts">
              <div className="charts-grid">
                <SensorChart dataKey="temperature" data={history.temperature} label="Temp History" unit="°C" />
                <SensorChart dataKey="humidity" data={history.humidity} label="Humidity History" unit="%" />
                <SensorChart dataKey="soil" data={history.soil} label="Soil History" unit="%" />
                <SensorChart dataKey="lux" data={history.lux} label="Light History" unit="%" />
              </div>
            </section>

            <style dangerouslySetInnerHTML={{ __html: `
              .smart-alert-banner { 
                background: #fff5f5; border: 2px solid #f85149; color: #f85149; 
                padding: 16px; border-radius: 12px; margin-bottom: 24px; 
                animation: pulseBorder 2s infinite; font-size: 15px;
              }
              @keyframes pulseBorder {
                0% { border-color: #f85149; box-shadow: 0 0 0 0 rgba(248, 81, 73, 0.4); }
                70% { border-color: #ff9b9b; box-shadow: 0 0 0 10px rgba(248, 81, 73, 0); }
                100% { border-color: #f85149; box-shadow: 0 0 0 0 rgba(248, 81, 73, 0); }
              }
            `}} />
          </div>
        );

      case 'control':
        return (
          <div className="control-page-layout">
            <ControlPanel devices={devices} control={control} />
            <style dangerouslySetInnerHTML={{
              __html: `
              .control-page-layout { max-width: 800px; margin: 0 auto; animation: fadeIn 0.4s ease; }
            `}} />
          </div>
        );

      case 'predict':
        return <WateringPrediction />;

      default:
        return null;
    }
  };

  const titles = { dashboard: 'Dashboard', control: 'Control', predict: 'Prediction' };

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} />
      <main className="main-content">
        <div className="topbar">
          <h2>{titles[page]}</h2>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <WsBadge connected={connected} />
            <SettingsMenu onLogout={onLogout} />
          </div>
        </div>
        {renderPage()}
      </main>
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState(localStorage.getItem('user_role'));

  const handleLogout = () => {
    authApi.logout();
    setRole(null);
  };

  if (!role) {
    return <LoginPage onLoginSuccess={setRole} />;
  }

  if (role === 'ADMIN') {
    return <AdminDashboard onLogout={handleLogout} />;
  }

  return <FarmerShell onLogout={handleLogout} />;
}
