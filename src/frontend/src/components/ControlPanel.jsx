function Toggle({ checked, onChange, id }) {
  return (
    <label className="toggle-wrap" htmlFor={id}>
      <input id={id} type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked ? 1 : 0)} />
      <span className="toggle-slider" />
    </label>
  );
}

export default function ControlPanel({ devices, control }) {
  const rows = [
    { key: 'pump', icon: '💧', iconClass: 'pump', name: 'Pump', desc: 'Manual' },
    { key: 'led', icon: '💡', iconClass: 'led', name: 'LED', desc: 'Manual' },
    { key: 'auto_pump', icon: '🤖', iconClass: 'auto', name: 'Auto Pump', desc: 'Hardware' },
    { key: 'auto_led', icon: '⚙️', iconClass: 'auto', name: 'Auto LED', desc: 'Hardware' },
  ];

  return (
    <div className="control-card">
      <h3>Manual Control</h3>
      <div className="control-grid-mini">
        {rows.map(row => (
          <div key={row.key} className="control-row-mini">
            <div className="control-info-mini">
              <div className={`control-icon-mini ${row.iconClass}`}>{row.icon}</div>
              <div>
                <div className="control-name-mini">{row.name}</div>
                <div className="control-status-mini">{devices[row.key] ? 'ON' : 'OFF'}</div>
              </div>
            </div>
            <Toggle
              id={`toggle-${row.key}`}
              checked={devices[row.key]}
              onChange={val => control(row.key, val)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
