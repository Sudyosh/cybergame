import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Terminal, TerminalLine } from '../components/common/Terminal';

export function Login() {
  const { t } = useLanguage();
  const { login, startSession } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await login(username, password);
      setSuccess(t('loginSuccess'));

      // Start game session
      await startSession();

      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || t('loginFailed'));
    }

    setLoading(false);
  };

  return (
    <div className="main-content">
      <Terminal title="access_terminal.exe">
        <TerminalLine type="command" prompt="$">
          ./authenticate --mode=login
        </TerminalLine>

        <div className="mt-2 mb-2">
          <TerminalLine type="output">
            <span className="text-cyan">MUT SECURE VAULT ACCESS TERMINAL</span>
          </TerminalLine>
          <TerminalLine type="output">
            <span className="text-dim">Enter your credentials to access the system...</span>
          </TerminalLine>
        </div>

        <form onSubmit={handleSubmit} className="mt-3">
          <div className="form-group">
            <label className="form-label">{t('username')}</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="agent_name"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('password')}</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
            />
          </div>

          {error && (
            <TerminalLine type="error">
              [ERROR] {error}
            </TerminalLine>
          )}

          {success && (
            <TerminalLine type="output">
              <span className="text-green">[SUCCESS] {success}</span>
            </TerminalLine>
          )}

          <div className="mt-3">
            <button
              type="submit"
              className="btn"
              disabled={loading}
            >
              {loading ? 'AUTHENTICATING...' : t('loginButton')}
            </button>
          </div>
        </form>

        <div className="mt-3">
          <TerminalLine type="output">
            <span className="text-dim">
              {t('noAccount')}{' '}
              <Link to="/register" className="text-cyan">
                [{t('register')}]
              </Link>
            </span>
          </TerminalLine>
        </div>
      </Terminal>
    </div>
  );
}

export default Login;
