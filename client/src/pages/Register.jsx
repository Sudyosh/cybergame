import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Terminal, TerminalLine } from '../components/common/Terminal';

export function Register() {
  const { t } = useLanguage();
  const { register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      await register(username, email, password);
      setSuccess('Registration successful! Redirecting to login...');

      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }

    setLoading(false);
  };

  return (
    <div className="main-content">
      <Terminal title="register_agent.exe">
        <TerminalLine type="command" prompt="$">
          ./create_account --type=agent
        </TerminalLine>

        <div className="mt-2 mb-2">
          <TerminalLine type="output">
            <span className="text-cyan">MUT SECURE VAULT REGISTRATION</span>
          </TerminalLine>
          <TerminalLine type="output">
            <span className="text-dim">Create your agent profile to begin the mission...</span>
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
              placeholder="agent_codename"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('email')}</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('password')}</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min. 8 characters"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('confirmPassword')}</label>
            <input
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="confirm password"
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
              {loading ? 'CREATING PROFILE...' : t('registerButton')}
            </button>
          </div>
        </form>

        <div className="mt-3">
          <TerminalLine type="output">
            <span className="text-dim">
              {t('hasAccount')}{' '}
              <Link to="/login" className="text-cyan">
                [{t('login')}]
              </Link>
            </span>
          </TerminalLine>
        </div>
      </Terminal>
    </div>
  );
}

export default Register;
