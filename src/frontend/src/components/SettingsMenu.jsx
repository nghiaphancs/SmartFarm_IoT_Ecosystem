import { useState, useRef, useEffect } from 'react';
import { authApi } from '../services/api';

export default function SettingsMenu({ onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      await authApi.changePassword(oldPassword, newPassword);
      setStatus({ type: 'success', msg: 'Password changed successfully!' });
      setTimeout(() => setShowModal(false), 2000);
      setOldPassword('');
      setNewPassword('');
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-menu-container" ref={menuRef}>
      <button className="settings-btn" onClick={() => setIsOpen(!isOpen)} title="Settings">
        ⚙️
      </button>

      {isOpen && (
        <div className="settings-dropdown">
          <div className="dropdown-item" onClick={() => { setIsOpen(false); setShowModal(true); }}>
            🔑 Change Password
          </div>
          <div className="dropdown-item text-red" onClick={onLogout}>
            🚪 Logout
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Change Password</h3>
            <form onSubmit={handleChangePassword}>
              {status && <div className={`alert alert-${status.type}`}>{status.msg}</div>}
              <div className="form-group">
                <label>Old Password</label>
                <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input type="password" value={newPassword} minLength={6} onChange={e => setNewPassword(e.target.value)} required />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="save-btn" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .settings-menu-container { position: relative; }
        .settings-btn { background: transparent; border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; font-size: 16px; cursor: pointer; color: var(--text-primary); transition: all 0.2s; }
        .settings-btn:hover { background: var(--bg-card-hover); }
        .settings-dropdown { position: absolute; top: 100%; right: 0; margin-top: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow); width: 200px; z-index: 100; overflow: hidden; animation: fadeIn 0.2s; }
        .dropdown-item { padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 500; transition: background 0.2s; }
        .dropdown-item:hover { background: var(--bg-card-hover); }
        .dropdown-item.text-red { color: #f85149; }
        .dropdown-item.text-red:hover { background: rgba(248,81,73,0.1); }
        
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { background: var(--bg-card); padding: 24px; border-radius: 12px; width: 100%; max-width: 400px; border: 1px solid var(--border); box-shadow: 0 10px 25px rgba(0,0,0,0.5); animation: slideUp 0.3s; }
        .modal-content h3 { margin-top: 0; margin-bottom: 20px; }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; font-weight: 600; text-transform: uppercase; }
        .form-group input { width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-body); color: var(--text-primary); }
        .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
        .cancel-btn { padding: 10px 16px; background: transparent; border: 1px solid var(--border); border-radius: 6px; color: var(--text-secondary); cursor: pointer; }
        .save-btn { padding: 10px 16px; background: #0ea5e9; border: none; border-radius: 6px; color: white; font-weight: 600; cursor: pointer; }
        .save-btn:disabled { opacity: 0.7; }
        .alert { padding: 10px; border-radius: 6px; margin-bottom: 16px; font-size: 14px; }
        .alert-error { background: rgba(248,81,73,0.1); color: #f85149; border: 1px solid rgba(248,81,73,0.3); }
        .alert-success { background: rgba(34, 197, 94, 0.1); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}} />
    </div>
  );
}
