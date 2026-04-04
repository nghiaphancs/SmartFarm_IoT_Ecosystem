import { useState } from 'react';
import { useSmartFarm } from './hooks/useSmartFarm';
import SensorCard from './components/SensorCard';
import SensorChart from './components/SensorChart';
import ControlPanel from './components/ControlPanel';
import AlertPanel from './components/AlertPanel';
import WateringPrediction from './pages/WateringPrediction';

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

export default function App() {
  const [page, setPage] = useState('dashboard');
  const { sensors, devices, alerts, connected, history, control } = useSmartFarm();

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return (
          <div className="dashboard-layout">
            <section className="dashboard-top">
              <div className="grid-4">
                <SensorCard type="temp" label="Temperature" value={sensors.temperature} unit="°C" icon="🌡️" />
                <SensorCard type="humidity" label="Air Humidity" value={sensors.humidity} unit="%" icon="💧" />
                <SensorCard type="soil" label="Soil Moisture" value={sensors.soil} unit="%" icon="🌱" />
                <SensorCard type="lux" label="Light" value={sensors.lux} unit="lux" icon="☀️" />
              </div>
            </section>

            <section className="dashboard-charts">
              <div className="charts-grid">
                <SensorChart dataKey="temperature" data={history.temperature} label="Temp History" unit="°C" />
                <SensorChart dataKey="humidity" data={history.humidity} label="Humidity History" unit="%" />
                <SensorChart dataKey="soil" data={history.soil} label="Soil History" unit="%" />
                <SensorChart dataKey="lux" data={history.lux} label="Light History" unit="lux" />
              </div>
            </section>
          </div>
        );

      case 'control':
        return (
          <div className="control-page-layout">
            <div className="bottom-grid-2">
              <ControlPanel devices={devices} control={control} />
              <AlertPanel alerts={alerts} />
            </div>
            <style dangerouslySetInnerHTML={{
              __html: `
              .control-page-layout { max-width: 900px; animation: fadeIn 0.4s ease; }
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
          <WsBadge connected={connected} />
        </div>
        {renderPage()}
      </main>
    </div>
  );
}
