import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Terminal, TerminalLine } from '../components/common/Terminal';
import { ChallengeProgress } from '../components/common/ChallengeProgress';
import api from '../services/api';

export function Challenge2() {
  const { language } = useLanguage();
  const { user, updateToken, refreshProgress } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Form states
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSetup, setOtpSetup] = useState(null);
  const [flag, setFlag] = useState('');
  const [mfaComplete, setMfaComplete] = useState(false);

  useEffect(() => {
    if (!user?.progress?.challenge1) {
      navigate('/dashboard');
      return;
    }
    fetchStatus();
  }, [user]);

  const fetchStatus = async () => {
    try {
      const response = await api.get('/api/c2/status');
      setStatus(response.data);
      setMfaComplete(response.data.mfaComplete);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch status');
    }
  };

  const handleVerifyPassword = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post('/api/c2/password', { password });
      setMessage(response.data.message?.[language] || response.data.message?.en || 'Verified');
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.hint?.[language] || 'Failed');
    }
    setLoading(false);
  };

  const handleVerifyPin = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post('/api/c2/pin', { pin });
      setMessage(response.data.message?.[language] || 'Verified');
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.hint?.[language] || 'Failed');
    }
    setLoading(false);
  };

  const handleSetupOTP = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/api/c2/otp/setup');
      setOtpSetup(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to setup OTP');
    }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post('/api/c2/otp/verify', { otp });
      setMessage(response.data.message?.[language] || 'Verified');
      if (response.data.mfaComplete) {
        setMfaComplete(true);
      }
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed');
    }
    setLoading(false);
  };

  const handleGetFlag = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/api/c2/mfa/status');
      if (response.data.flag2) {
        setFlag(response.data.flag2);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to get flag');
    }
    setLoading(false);
  };

  const handleSubmitFlag = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/api/c2/submit-flag', { flag });
      if (response.data.correct) {
        if (response.data.newToken) {
          updateToken(response.data.newToken);
        }
        await refreshProgress();
        setMessage('FLAG_2 CORRECT! Challenge 2 Complete!');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed');
    }
    setLoading(false);
  };

  const factors = status?.factors || {};

  return (
    <div className="main-content">
      <ChallengeProgress />

      <Terminal title="challenge_2_authentication.exe">
        <TerminalLine type="command" prompt="$">
          ./challenge_2 --start
        </TerminalLine>

        <div className="mt-2">
          <TerminalLine type="output">
            <span className="text-cyan">
              {language === 'en' ? "CHAPTER 2: THE GUARDIAN'S GAUNTLET" : 'บทที่ 2: ด่านของผู้พิทักษ์'}
            </span>
          </TerminalLine>
          <TerminalLine type="output">
            <span className="text-dim">
              {language === 'en' ?
                'Prove your identity through Multi-Factor Authentication' :
                'พิสูจน์ตัวตนผ่านการยืนยันหลายปัจจัย'}
            </span>
          </TerminalLine>
        </div>

        {/* Status Display */}
        <div className="mt-3 grid grid-3">
          <div className={`card ${factors.password?.verified ? 'status-success' : ''}`}>
            <div className="text-center">
              <div className="text-cyan">FACTOR 1</div>
              <div className="text-white">Password</div>
              <div>{factors.password?.verified ? '✓' : '○'}</div>
            </div>
          </div>
          <div className={`card ${factors.pin?.verified ? 'status-success' : ''}`}>
            <div className="text-center">
              <div className="text-cyan">FACTOR 2</div>
              <div className="text-white">PIN</div>
              <div>{factors.pin?.verified ? '✓' : '○'}</div>
            </div>
          </div>
          <div className={`card ${factors.otp?.verified ? 'status-success' : ''}`}>
            <div className="text-center">
              <div className="text-cyan">FACTOR 3</div>
              <div className="text-white">OTP</div>
              <div>{factors.otp?.verified ? '✓' : '○'}</div>
            </div>
          </div>
        </div>

        {/* Factor 1: Password */}
        {!factors.password?.verified && (
          <div className="mt-3 card">
            <div className="card-title">FACTOR 1: PASSWORD</div>
            <div className="card-content">
              <TerminalLine type="output">
                <span className="text-dim">
                  {factors.password?.hint?.[language] || factors.password?.hint?.en ||
                    'Hint: The name of our university combined with its birth year...'}
                </span>
              </TerminalLine>
              <div className="form-group mt-2">
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                />
              </div>
              <button className="btn" onClick={handleVerifyPassword} disabled={loading}>
                {loading ? 'VERIFYING...' : 'VERIFY PASSWORD'}
              </button>
            </div>
          </div>
        )}

        {/* Factor 2: PIN */}
        {factors.password?.verified && !factors.pin?.verified && (
          <div className="mt-3 card">
            <div className="card-title">FACTOR 2: PIN</div>
            <div className="card-content">
              <TerminalLine type="output">
                <span className="text-dim">
                  {factors.pin?.hint?.[language] || factors.pin?.hint?.en ||
                    'Hint: The postal code of our sacred location (5 digits)...'}
                </span>
              </TerminalLine>
              <TerminalLine type="output">
                <span className="text-yellow">
                  Attempts: {factors.pin?.attempts || 0}/{factors.pin?.maxAttempts || 3}
                </span>
              </TerminalLine>
              <div className="form-group mt-2">
                <input
                  type="text"
                  className="form-input"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter 5-digit PIN"
                  maxLength={5}
                />
              </div>
              <button className="btn" onClick={handleVerifyPin} disabled={loading}>
                {loading ? 'VERIFYING...' : 'VERIFY PIN'}
              </button>
            </div>
          </div>
        )}

        {/* Factor 3: OTP */}
        {factors.pin?.verified && !factors.otp?.verified && (
          <div className="mt-3 card">
            <div className="card-title">FACTOR 3: OTP (TIME-BASED)</div>
            <div className="card-content">
              {!otpSetup ? (
                <>
                  <TerminalLine type="output">
                    <span className="text-dim">
                      Your FLAG_1 generates the OTP secret. Click to setup.
                    </span>
                  </TerminalLine>
                  <button className="btn mt-2" onClick={handleSetupOTP} disabled={loading}>
                    SETUP OTP
                  </button>
                </>
              ) : (
                <>
                  <TerminalLine type="output">
                    <span className="text-cyan">OTP Secret (Base32):</span>
                  </TerminalLine>
                  <div className="code-block mt-1">
                    {otpSetup.secret}
                  </div>
                  {otpSetup.qrCode && (
                    <div className="mt-2 text-center">
                      <img src={otpSetup.qrCode} alt="OTP QR Code" style={{ maxWidth: '200px' }} />
                    </div>
                  )}
                  <div className="form-group mt-2">
                    <input
                      type="text"
                      className="form-input"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                    />
                  </div>
                  <button className="btn" onClick={handleVerifyOTP} disabled={loading}>
                    VERIFY OTP
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* MFA Complete - Get Flag */}
        {mfaComplete && !flag && (
          <div className="mt-3 card">
            <div className="card-title">MFA COMPLETE!</div>
            <div className="card-content">
              <TerminalLine type="output">
                <span className="text-green glow">
                  {language === 'en' ? 'All 3 factors verified!' : 'ยืนยันครบ 3 ปัจจัยแล้ว!'}
                </span>
              </TerminalLine>
              <button className="btn mt-2" onClick={handleGetFlag} disabled={loading}>
                REVEAL FLAG_2
              </button>
            </div>
          </div>
        )}

        {/* Flag Display & Submit */}
        {flag && (
          <div className="mt-3">
            <div className="flag-display">
              <div className="text-cyan">FLAG_2:</div>
              <div className="text-green glow">{flag}</div>
            </div>
            <div className="mt-2">
              <button className="btn" onClick={handleSubmitFlag} disabled={loading}>
                SUBMIT FLAG_2
              </button>
            </div>
          </div>
        )}

        {/* Completed */}
        {user?.progress?.challenge2 && (
          <div className="mt-3 flag-display">
            <TerminalLine type="output">
              <span className="text-green glow">CHALLENGE 2 COMPLETE</span>
            </TerminalLine>
            <div className="mt-2">
              <button className="btn" onClick={() => navigate('/challenge/3')}>
                PROCEED TO CHALLENGE 3
              </button>
            </div>
          </div>
        )}

        {message && (
          <TerminalLine type="output" className="mt-2">
            <span className="text-green">[SUCCESS] {message}</span>
          </TerminalLine>
        )}

        {error && (
          <TerminalLine type="error" className="mt-2">
            [ERROR] {error}
          </TerminalLine>
        )}
      </Terminal>
    </div>
  );
}

export default Challenge2;
