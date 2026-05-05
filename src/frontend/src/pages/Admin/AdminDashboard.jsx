import { useState, useEffect, useRef } from 'react';
import { authApi, actuatingApi, aiApi, mlApi, systemApi } from '../../services/api';
import SettingsMenu from '../../components/SettingsMenu';

// ── User Management (F-ADMIN-1) ───────────────────────────────────────────────
function UserManagement() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: '', password: '', role: 'FARMER' });
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      const data = await authApi.listUsers();
      setUsers(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.createUser(form.username, form.password, form.role);
      setForm({ username: '', password: '', role: 'FARMER' });
      fetchUsers();
    } catch (e) { alert(e.message); }
    finally { setLoading(false); }
  };

  const handleToggle = async (id) => {
    try {
      await authApi.toggleUser(id);
      fetchUsers();
    } catch (e) { alert(e.message); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await authApi.deleteUser(id);
      fetchUsers();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="admin-tab">
      <h3>User Management</h3>
      <form onSubmit={handleCreate} className="admin-form-inline">
        <input type="text" placeholder="Username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
        <input type="password" placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
        <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
          <option value="FARMER">Farmer</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button type="submit" disabled={loading}>+ Create User</button>
      </form>
      <table className="admin-table">
        <thead><tr><th>ID</th><th>Username</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.username}</td>
              <td><span className={`role-badge ${u.role.toLowerCase()}`}>{u.role}</span></td>
              <td>{u.is_active ? '✅ Active' : '❌ Locked'}</td>
              <td>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleToggle(u.id)} className="action-btn">
                    {u.is_active ? 'Lock' : 'Unlock'}
                  </button>
                  <button onClick={() => handleDelete(u.id)} className="action-btn del-btn" style={{ padding: '6px 12px' }}>
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Threshold Config (F-ADMIN-4) ─────────────────────────────────────────────
function ThresholdManagement() {
  const [configs, setConfigs] = useState([]);
  const [cfgForm, setCfgForm] = useState({ config_key: 'threshold_temp', config_value: '' });

  const fetchConfigs = async () => {
    try {
      setConfigs(await actuatingApi.getConfigurations());
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchConfigs(); }, []);

  const handleSetThreshold = async (e) => {
    e.preventDefault();
    try {
      await actuatingApi.upsertConfiguration(cfgForm.config_key, parseFloat(cfgForm.config_value));
      setCfgForm({ ...cfgForm, config_value: '' });
      fetchConfigs();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="admin-tab">
      <h3>System Thresholds & Rules</h3>
      <div className="admin-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h4>Update Threshold</h4>
        <form onSubmit={handleSetThreshold} className="admin-form">
          <select value={cfgForm.config_key} onChange={e => setCfgForm({ ...cfgForm, config_key: e.target.value })} required>
            <option value="threshold_temp">Max Temperature (°C)</option>
            <option value="threshold_humidity">Min Air Humidity (%)</option>
            <option value="threshold_soil">Min Soil Moisture (%)</option>
            <option value="threshold_lux">Min Light Level (%)</option>
          </select>
          <input type="number" step="0.1" placeholder="Value" value={cfgForm.config_value} onChange={e => setCfgForm({ ...cfgForm, config_value: e.target.value })} required />
          <button type="submit">Save Configuration</button>
        </form>
        <h4 style={{ marginTop: '24px', marginBottom: '16px' }}>Current Configurations</h4>
        <ul className="admin-list">
          {configs.map(c => (
            <li key={c.id}>
              <span>{c.config_key}</span>
              <span className="badge">{c.config_value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── System Logs & Backup (F-ADMIN-5, F-ADMIN-6) ───────────────────────────────
function SystemManagement() {
  const [logs, setLogs] = useState([]);

  const fetchLogs = async () => {
    try {
      const data = await systemApi.getSystemLogs(50);
      setLogs(data.logs || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchLogs(); }, []);

  return (
    <div className="admin-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>System Operations</h3>
        <button className="primary-btn" onClick={() => window.open(systemApi.getBackupDbUrl(), '_blank')}>
          💾 Download DB Backup
        </button>
      </div>
      <div className="admin-card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h4>Backend Console Logs</h4>
          <button className="action-btn" onClick={fetchLogs}>🔄 Refresh</button>
        </div>
        <div className="log-viewer">
          {logs.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      </div>
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────
export default function AdminDashboard({ onLogout }) {
  const [tab, setTab] = useState('users');

  const TABS = [
    { id: 'users', icon: '👥', label: 'User Management' },
    { id: 'thresholds', icon: '🎚️', label: 'Thresholds Config' },
    { id: 'system', icon: '📈', label: 'System Logs' },
  ];

  return (
    <div className="admin-shell">
      <div className="admin-sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">🛡️</div>
          <div>
            <h1>Admin Panel</h1>
            <span>System Management</span>
          </div>
        </div>
        <nav className="admin-nav">
          {TABS.map(t => (
            <div key={t.id} className={`nav-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.icon} {t.label}
            </div>
          ))}
        </nav>
      </div>

      <main className="admin-main">
        <div className="topbar" style={{ padding: '20px 40px', borderBottom: '1px solid var(--border)', background: 'var(--bg-body)' }}>
          <h2></h2>
          <SettingsMenu onLogout={() => { authApi.logout(); onLogout(); }} />
        </div>
        <div className="admin-content">
          {tab === 'users' && <UserManagement />}
          {tab === 'thresholds' && <ThresholdManagement />}
          {tab === 'system' && <SystemManagement />}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .admin-shell { display: flex; height: 100vh; background: var(--bg-body); color: var(--text-primary); }
        .admin-sidebar { width: 260px; background: var(--bg-card); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 24px 0; }
        .admin-nav { flex: 1; display: flex; flex-direction: column; gap: 8px; padding: 0 16px; margin-top: 30px; }
        .admin-nav .nav-item { padding: 12px 16px; border-radius: 8px; color: var(--text-secondary); cursor: pointer; transition: all 0.2s; font-weight: 500; }
        .admin-nav .nav-item:hover { background: var(--bg-card-hover); color: var(--text-primary); }
        .admin-nav .nav-item.active { background: rgba(14, 165, 233, 0.1); color: #0ea5e9; font-weight: 600; }
        .admin-nav .nav-item.active { background: rgba(14, 165, 233, 0.1); color: #0ea5e9; font-weight: 600; }
        .admin-main { flex: 1; display: flex; flex-direction: column; overflow-y: auto; }
        .admin-content { padding: 40px; display: flex; flex-direction: column; align-items: center; }
        .admin-tab { max-width: 1000px; width: 100%; animation: fadeIn 0.3s; }
        .admin-tab h3 { margin-top: 0; font-size: 24px; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 24px; }
        
        .admin-form-inline { display: flex; gap: 12px; margin-bottom: 24px; }
        .admin-form-inline input, .admin-form-inline select { padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-card); color: var(--text-primary); }
        .admin-form-inline button { padding: 10px 16px; background: #0ea5e9; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
        
        .admin-table { width: 100%; border-collapse: collapse; background: var(--bg-card); border-radius: 8px; overflow: hidden; box-shadow: var(--shadow); }
        .admin-table th, .admin-table td { padding: 14px; text-align: left; border-bottom: 1px solid var(--border); }
        .admin-table th { background: var(--bg-card-hover); font-weight: 600; color: var(--text-secondary); }
        .role-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .role-badge.admin { background: rgba(14, 165, 233, 0.1); color: #0ea5e9; }
        .role-badge.farmer { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
        .action-btn { padding: 6px 12px; border: 1px solid var(--border); background: transparent; color: var(--text-primary); border-radius: 4px; cursor: pointer; }
        
        .split-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .admin-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 24px; box-shadow: var(--shadow); }
        .admin-card h4 { margin-top: 0; margin-bottom: 16px; }
        .admin-form { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
        .admin-form input, .admin-form select { padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-card-hover); color: white; }
        .admin-form button { padding: 10px; background: #22c55e; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
        .admin-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
        .admin-list li { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-card-hover); border-radius: 6px; }
        .del-btn { background: rgba(248,81,73,0.1); color: #f85149; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; }
        .badge { background: #334155; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-family: monospace; }
        
        .upload-btn { display: inline-block; padding: 12px 24px; background: #0ea5e9; color: white; border-radius: 8px; cursor: pointer; font-weight: bold; margin-top: 16px; }
        .text-center { text-align: center; }
        .admin-alert { padding: 12px; background: rgba(34, 197, 94, 0.1); color: #22c55e; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(34, 197, 94, 0.3); }
        
        .primary-btn { padding: 10px 16px; background: #0ea5e9; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
        .log-viewer { background: #0f172a; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 13px; color: #38bdf8; overflow-y: auto; max-height: 400px; white-space: pre-wrap; margin-top: 16px; }
      `}} />
    </div>
  );
}
