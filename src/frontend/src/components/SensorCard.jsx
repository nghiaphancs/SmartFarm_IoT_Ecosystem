export default function SensorCard({ type, label, value, unit, icon, isAlert, alertMsg }) {
  const fmt = value !== null && value !== undefined
    ? parseFloat(value).toFixed(1)
    : '—';

  return (
    <div className={`sensor-card ${type} ${isAlert ? 'alerting' : ''}`}>
      <div className="card-header">
        <div className={`card-icon ${type}`}>{icon}</div>
        <span className="card-label">
          {label}
          {isAlert && <span className="alert-badge">ALERT!</span>}
        </span>
      </div>
      <div className={`card-value ${type}`}>
        {fmt}
        <span className="card-unit"> {unit}</span>
      </div>
      <div className="card-trend">
        {value === null 
          ? 'No data yet' 
          : (isAlert && alertMsg ? <span style={{color: '#f85149', fontWeight: 'bold'}}>{alertMsg}</span> : 'Live data from YOLO:bit')}
      </div>
    </div>
  );
}
