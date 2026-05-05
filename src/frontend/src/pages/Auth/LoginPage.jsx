import { useState } from 'react';
import { authApi } from '../../services/api';

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await authApi.login(username, password);
      onLoginSuccess(data.role);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-icon">🌱</div>
          <h1>SmartFarm</h1>
          <p>Sign in to access your IoT Ecosystem</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">⚠️ {error}</div>}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter your username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
          </div>

          <button type="submit" disabled={loading} className="login-btn">
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-body);
          padding: 20px;
        }
        .login-container {
          background: var(--bg-card);
          padding: 40px;
          border-radius: var(--radius);
          box-shadow: var(--shadow);
          width: 100%;
          max-width: 400px;
          border: 1px solid var(--border);
          animation: slideUp 0.5s ease;
        }
        .login-header {
          text-align: center;
          margin-bottom: 30px;
        }
        .login-icon {
          font-size: 48px;
          margin-bottom: 10px;
        }
        .login-header h1 {
          margin: 0 0 8px;
          font-size: 24px;
          color: var(--text-primary);
        }
        .login-header p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 14px;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .form-group label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .form-group input {
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--bg-card-hover);
          color: var(--text-primary);
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .form-group input:focus {
          border-color: var(--green);
          box-shadow: 0 0 0 3px var(--green-dim);
        }
        .login-btn {
          margin-top: 10px;
          padding: 14px;
          border: none;
          border-radius: 8px;
          background: linear-gradient(135deg, var(--green), #2ea043);
          color: white;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px var(--green-dim);
        }
        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .login-error {
          padding: 12px;
          border-radius: 8px;
          background: rgba(248,81,73,0.1);
          border: 1px solid rgba(248,81,73,0.3);
          color: #f85149;
          font-size: 13px;
          text-align: center;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
