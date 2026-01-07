import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

export function Header() {
  const { language, toggleLanguage, t } = useLanguage();
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="header">
      <Link to="/" className="header-logo">
        [MUT_VAULT]
      </Link>

      <nav className="header-nav">
        {isAuthenticated ? (
          <>
            <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
              {t('dashboard')}
            </Link>
            <Link to="/challenge/1" className={`nav-link ${isActive('/challenge/1') ? 'active' : ''}`}>
              C1
            </Link>
            <Link to="/challenge/2" className={`nav-link ${isActive('/challenge/2') ? 'active' : ''}`}>
              C2
            </Link>
            <Link to="/challenge/3" className={`nav-link ${isActive('/challenge/3') ? 'active' : ''}`}>
              C3
            </Link>
            <span className="nav-link text-dim">
              @{user?.username || 'agent'}
            </span>
            <button onClick={handleLogout} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              [{t('logout')}]
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className={`nav-link ${isActive('/login') ? 'active' : ''}`}>
              {t('login')}
            </Link>
            <Link to="/register" className={`nav-link ${isActive('/register') ? 'active' : ''}`}>
              {t('register')}
            </Link>
          </>
        )}
      </nav>

      <div className="lang-switch">
        <button
          className={`lang-btn ${language === 'en' ? 'active' : ''}`}
          onClick={() => language !== 'en' && toggleLanguage()}
        >
          EN
        </button>
        <button
          className={`lang-btn ${language === 'th' ? 'active' : ''}`}
          onClick={() => language !== 'th' && toggleLanguage()}
        >
          TH
        </button>
      </div>
    </header>
  );
}

export default Header;
