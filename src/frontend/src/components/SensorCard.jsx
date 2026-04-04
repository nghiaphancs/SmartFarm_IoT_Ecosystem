export default function SensorCard({ type, label, value, unit, icon }) {
  const fmt = value !== null && value !== undefined
    ? parseFloat(value).toFixed(1)
    : '—';

  return (
    <div className={`sensor-card ${type}`}>
      <div className="card-header">
        <div className={`card-icon ${type}`}>{icon}</div>
        <span className="card-label">{label}</span>
      </div>
      <div className={`card-value ${type}`}>
        {fmt}
        <span className="card-unit"> {unit}</span>
      </div>
      <div className="card-trend">
        {value === null ? 'No data yet' : 'Live data from YOLO:bit'}
      </div>
    </div>
  );
}
