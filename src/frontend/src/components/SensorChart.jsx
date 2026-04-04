import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const COLOR_MAP = {
  temperature: '#f78166',
  humidity: '#58a6ff',
  soil: '#3fb950',
  lux: '#d29922',
};

function CustomTooltip({ active, payload, label }) {
  if (active && payload?.length) {
    return (
      <div style={{
        background: '#1c2333', border: '1px solid #30363d',
        borderRadius: 8, padding: '8px 14px', fontSize: 13
      }}>
        <p style={{ color: '#8b949e', marginBottom: 4 }}>{label}</p>
        <p style={{ color: payload[0]?.color, fontWeight: 600 }}>
          {payload[0]?.value?.toFixed(1)}
        </p>
      </div>
    );
  }
  return null;
}

export default function SensorChart({ dataKey, data, label, unit }) {
  const color = COLOR_MAP[dataKey] || '#58a6ff';

  if (!data || data.length === 0) {
    return (
      <div className="chart-card">
        <h3>{label} <span style={{ fontSize: 12, color: '#8b949e' }}>({unit})</span></h3>
        <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#484f58' }}>
          Waiting for data…
        </div>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <h3>{label} <span style={{ fontSize: 12, color: '#8b949e' }}>({unit})</span></h3>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: '#484f58', fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: '#484f58', fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${dataKey})`}
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
