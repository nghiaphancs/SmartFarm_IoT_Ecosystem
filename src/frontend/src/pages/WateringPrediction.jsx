import { useState, useCallback } from 'react';

const SOIL_TYPES = [
  { id: 'sandy', label: 'Sandy — drains fast' },
  { id: 'loamy', label: 'Loamy — balanced' },
  { id: 'clay', label: 'Clay — retains water' },
];

const GROWTH_STAGES = [
  { id: 'seedling', label: 'Seedling — Low need' },
  { id: 'vegetative', label: 'Vegetative — Moderate' },
  { id: 'flowering', label: 'Flowering — High' },
  { id: 'fruiting', label: 'Fruiting — Very high' },
];

// Plant type IDs must match the training dataset Vietnamese labels exactly
const PLANT_TYPES = [
  { id: 'Rau muống', label: 'Water Spinach (Rau muống)' },
  { id: 'Cải, xà lách', label: 'Lettuce / Cabbage (Cải, xà lách)' },
  { id: 'Cà chua', label: 'Tomato (Cà chua)' },
  { id: 'Dưa leo', label: 'Cucumber (Dưa leo)' },
  { id: 'Chuối', label: 'Banana (Chuối)' },
  { id: 'Xoài', label: 'Mango (Xoài)' },
  { id: 'Thanh long', label: 'Dragon Fruit (Thanh long)' },
  { id: 'Sầu riêng', label: 'Durian (Sầu riêng)' },
  { id: 'Cam, bưởi', label: 'Citrus — Orange / Pomelo' },
];

const DEFAULT_FORM = {
  temperature: 30,
  air_humidity: 70,
  soil_moisture: 50,
  light: 25000,
  rainfall: 0,
  soil_type: 'loamy',
  growth_stage: 'vegetative',
  plant_type: 'Cà chua',
};

function WaterGauge({ ml }) {
  const liters = (ml / 1000).toFixed(2);
  const advice =
    ml === 0 ? 'No irrigation needed right now 🎉' :
      ml < 500 ? 'Light watering — short irrigation cycle' :
        ml < 2000 ? 'Moderate watering — standard cycle' :
          ml < 6000 ? 'Heavy watering — extended irrigation' :
            'Very heavy watering — large fruit tree cycle';

  return (
    <div className="gauge-wrapper">
      <div className="gauge-top">
        <div className="gauge-drop">💧</div>
        <div className="gauge-values">
          <span className="gauge-ml">{ml.toLocaleString()} <small>ml</small></span>
          <span className="gauge-liter">{liters} L</span>
        </div>
      </div>
      <div className="gauge-bar">
        <div
          className="gauge-fill"
          style={{ width: `${Math.min(100, (ml / 12000) * 100)}%` }}
        />
      </div>
      <p className="gauge-advice">💡 {advice}</p>
    </div>
  );
}

export default function WateringPrediction() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = useCallback((e) => {
    const { name, value, type } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));
    setPrediction(null);
  }, []);

  const handleBlur = useCallback((e) => {
    const { name, value } = e.target;
    if (name === 'light') {
      const val = parseFloat(value);
      if (!isNaN(val)) {
        // Snap to nearest 100 (Threshold x50: 45 -> 0, 55 -> 100)
        setForm(prev => ({ ...prev, light: Math.round(val / 100) * 100 }));
      }
    }
  }, []);

  const handleAutoFill = async () => {
    setAutofilling(true);
    try {
      const res = await fetch('http://localhost:8000/api/sensors-for-predict');
      const data = await res.json();
      
      // Get Location & Fetch 24h rainfall from Open-Meteo
      let autoRainfall = null;

      const fetchRainfall = async (lat, lon) => {
        try {
          const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum&timezone=auto&past_days=1&forecast_days=1`);
          if (weatherRes.ok) {
            const weatherData = await weatherRes.json();
            if (weatherData?.daily?.precipitation_sum?.length > 0) {
              return weatherData.daily.precipitation_sum[0]; // yesterday's local rainfall
            }
          }
        } catch (err) {
          console.warn('Rainfall API error:', err);
        }
        return null;
      };

      if ('geolocation' in navigator) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          autoRainfall = await fetchRainfall(position.coords.latitude, position.coords.longitude);
        } catch (geoErr) {
          console.warn('Geolocation denied or timeout, fallback to HCM City.', geoErr);
          autoRainfall = await fetchRainfall(10.8231, 106.6297);
        }
      } else {
        autoRainfall = await fetchRainfall(10.8231, 106.6297);
      }

      setForm(prev => ({
        ...prev,
        temperature:   data.temperature !== null   ? Math.round(data.temperature * 10) / 10 : prev.temperature,
        air_humidity:  data.air_humidity !== null  ? Math.round(data.air_humidity * 10) / 10 : prev.air_humidity,
        soil_moisture: data.soil_moisture !== null ? Math.round(data.soil_moisture * 10) / 10 : prev.soil_moisture,
        light:         data.light !== null         ? Math.round(data.light / 100) * 100 : prev.light,
        rainfall:      autoRainfall !== null       ? autoRainfall : prev.rainfall,
      }));
      setPrediction(null);
    } catch {
      /* ignore if backend unreachable */
    } finally {
      setAutofilling(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:8000/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? 'Prediction failed');
      }
      const data = await res.json();
      setPrediction(data.water_amount);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pred-page">

      {/* Header */}
      <div className="pred-header">
        <div>
          <h2 className="pred-title">🧠 Smart Watering Prediction</h2>
          <p className="pred-sub">ML model predicts optimal irrigation volume based on environment &amp; plant data.</p>
        </div>
        <div className="pred-badge">
          <span>⚡ Powered by</span>
          <span className="badge-sep">|</span>
          <span>XGBoost</span>
        </div>
      </div>

      <div className="pred-body">
        {/* Form card */}
        <form className="pred-card" onSubmit={handleSubmit}>
          {/* Section: Environment */}
          <div className="section-label">
            <span>🌡️ Environmental Conditions</span>
            <button type="button" className="autofill-btn" onClick={handleAutoFill} disabled={autofilling}>
              {autofilling ? '⏳ Fetching…' : '📡 Auto-fill from Sensors'}
            </button>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Temperature (°C)</span>
              <input type="number" name="temperature" value={form.temperature} min={10} max={50} step={0.1} onChange={handleChange} />
            </label>
            <label className="field">
              <span>Air Humidity (%)</span>
              <input type="number" name="air_humidity" value={form.air_humidity} min={0} max={100} step={0.1} onChange={handleChange} />
            </label>
            <label className="field">
              <span>Soil Moisture (%)</span>
              <input type="number" name="soil_moisture" value={form.soil_moisture} min={0} max={100} step={0.1} onChange={handleChange} />
            </label>
            <label className="field">
              <span>Light Intensity (lux)</span>
              <input 
                type="number" 
                name="light" 
                value={form.light} 
                min={0} 
                max={120000} 
                step={100} 
                onChange={handleChange} 
                onBlur={handleBlur}
              />
            </label>
            <label className="field">
              <span>Rainfall last 24h (mm)</span>
              <input type="number" name="rainfall" value={form.rainfall} min={0} max={200} step={0.1} onChange={handleChange} />
            </label>
          </div>

          {/* Section: Plant info */}
          <div className="section-label" style={{ marginTop: 8 }}>
            <span>🌱 Plant Characteristics</span>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Soil Type</span>
              <select name="soil_type" value={form.soil_type} onChange={handleChange}>
                {SOIL_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Growth Stage</span>
              <select name="growth_stage" value={form.growth_stage} onChange={handleChange}>
                {GROWTH_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Plant Type</span>
              <select name="plant_type" value={form.plant_type} onChange={handleChange}>
                {PLANT_TYPES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
          </div>

          {error && <div className="pred-error">⚠️ {error}</div>}

          <button className="pred-submit" type="submit" disabled={loading}>
            {loading ? <span className="spin">⏳</span> : '💧 Predict Water Amount'}
          </button>
        </form>

        {/* Result card */}
        {prediction !== null && (
          <div className="pred-result-card" key={prediction}>
            <div className="result-title">Recommended Water Amount</div>
            <WaterGauge ml={prediction} />
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        /* ── Page layout ── */
        .pred-page { display: flex; flex-direction: column; gap: 20px; max-width: 960px; animation: fadeIn .4s ease; }

        /* ── Header ── */
        .pred-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .pred-title { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
        .pred-sub { color: var(--text-secondary); font-size: 13px; margin: 0; }
        .pred-badge { 
          display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600;
          background: var(--green-dim); border: 1px solid var(--green); border-radius: 999px;
          padding: 6px 14px; color: var(--green); white-space: nowrap; height: fit-content;
        }
        .badge-sep { opacity: .4; }

        /* ── Body ── */
        .pred-body { display: flex; flex-direction: column; gap: 20px; }

        /* ── Form card ── */
        .pred-card {
          background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
          padding: 28px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 20px;
        }

        /* ── Section labels ── */
        .section-label {
          display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
          font-size: 13px; font-weight: 700; color: var(--text-secondary);
          text-transform: uppercase; letter-spacing: .6px;
          border-bottom: 1px solid var(--border); padding-bottom: 10px;
        }
        .autofill-btn {
          font-size: 12px; font-weight: 600; background: var(--bg-card-hover);
          border: 1px solid var(--border); border-radius: 6px; padding: 5px 12px;
          color: var(--text-primary); cursor: pointer; transition: .2s;
          font-family: inherit;
        }
        .autofill-btn:hover { border-color: var(--green); color: var(--green); }
        .autofill-btn:disabled { opacity: .5; cursor: default; }

        /* ── Grid ── */
        .form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 780px) { .form-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .form-grid { grid-template-columns: 1fr; } }

        /* ── Fields ── */
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field > span { font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .4px; }
        .field input, .field select {
          background: var(--bg-card-hover); border: 1px solid var(--border); border-radius: 8px;
          padding: 11px 13px; color: var(--text-primary); font-family: inherit;
          font-size: 14px; outline: none; transition: border-color .2s, box-shadow .2s;
        }
        .field input:focus, .field select:focus {
          border-color: var(--green); box-shadow: 0 0 0 3px var(--green-dim);
        }

        /* ── Error ── */
        .pred-error {
          background: rgba(248,81,73,.12); border: 1px solid rgba(248,81,73,.4);
          border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #f85149;
        }

        /* ── Submit ── */
        .pred-submit {
          background: linear-gradient(135deg, var(--green), #2ea043);
          color: #fff; border: none; padding: 16px; border-radius: 10px;
          font-weight: 700; font-size: 15px; cursor: pointer; font-family: inherit;
          transition: transform .25s, box-shadow .25s, filter .25s; display: flex;
          justify-content: center; align-items: center; gap: 8px;
        }
        .pred-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 16px var(--green-dim); filter: brightness(1.1); }
        .pred-submit:disabled { opacity: .55; cursor: not-allowed; }
        .spin { animation: spin 1s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Result card ── */
        .pred-result-card {
          background: var(--bg-card); border: 1px solid var(--green);
          border-radius: var(--radius); padding: 28px;
          box-shadow: 0 0 24px var(--green-dim);
          animation: slideUp .5s cubic-bezier(.16,1,.3,1);
        }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .result-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: var(--text-secondary); margin-bottom: 20px; }

        /* ── Gauge ── */
        .gauge-wrapper { display: flex; flex-direction: column; gap: 16px; }
        .gauge-top { display: flex; align-items: center; gap: 20px; }
        .gauge-drop { font-size: 52px; line-height: 1; }
        .gauge-values { display: flex; flex-direction: column; }
        .gauge-ml { font-size: 40px; font-weight: 800; color: var(--green); letter-spacing: -1px; }
        .gauge-ml small { font-size: 18px; font-weight: 500; color: var(--text-secondary); }
        .gauge-liter { font-size: 15px; color: var(--text-secondary); margin-top: 2px; }
        .gauge-bar { height: 10px; background: var(--border); border-radius: 999px; overflow: hidden; }
        .gauge-fill {
          height: 100%; border-radius: 999px;
          background: linear-gradient(90deg, #2ea043, var(--green), #7ee787);
          transition: width 1s cubic-bezier(.16,1,.3,1);
        }
        .gauge-advice { font-size: 14px; color: var(--text-secondary); margin: 0; }
      `}} />
    </div>
  );
}
