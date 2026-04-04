export default function AlertPanel({ alerts }) {
  return (
    <div className="alert-card-mini">
      <h3>⚠️ Alerts</h3>
      <div className="alert-list-mini">
        {alerts.length === 0 ? (
          <div className="alert-empty-mini">No active alerts.</div>
        ) : (
          [...alerts].reverse().slice(0, 3).map((a, i) => (
            <div key={i} className="alert-item-mini">
              <div className="alert-item-icon">🌡️</div>
              <div className="alert-item-text">
                <strong>High Temp</strong>
                <span>{a.value}°C · {a.time || 'now'}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
