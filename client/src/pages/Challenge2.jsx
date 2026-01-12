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
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [demoOTP, setDemoOTP] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [flag, setFlag] = useState('');
  const [flagInput, setFlagInput] = useState('');
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
      if (response.data.mfaComplete) {
        handleGetFlag();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch status');
    }
  };

  // Factor 1: Email OTP
  const handleSendOTP = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post('/api/c2/email/send-otp', { email });
      setMessage(response.data.message?.[language] || response.data.message?.en || 'OTP sent');
      setOtpSent(true);
      setDemoOTP(response.data.demoOTP || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post('/api/c2/email/verify-otp', { otp });
      setMessage(response.data.message?.[language] || response.data.message?.en || 'Verified');
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.hint?.[language] || 'Failed');
    }
    setLoading(false);
  };

  // Factor 2: Password
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

  // Factor 3: PIN
  const handleVerifyPin = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post('/api/c2/pin', { pin });
      setMessage(response.data.message?.[language] || 'Verified');
      if (response.data.mfaComplete) {
        setMfaComplete(true);
        await handleGetFlag();
      }
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.hint?.[language] || 'Failed');
    }
    setLoading(false);
  };

  const handleGetFlag = async () => {
    try {
      const response = await api.get('/api/c2/mfa/status');
      if (response.data.flag2) {
        setFlag(response.data.flag2);
        setFlagInput(response.data.flag2);
      }
    } catch (err) {
      console.error('Failed to get flag:', err);
    }
  };

  const handleSubmitFlag = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/api/c2/submit-flag', { flag: flagInput });
      if (response.data.correct) {
        if (response.data.newToken) {
          updateToken(response.data.newToken);
        }
        await refreshProgress();
        setMessage(language === 'en' ? 'FLAG_2 CORRECT! Challenge 2 Complete!' : 'FLAG_2 ถูกต้อง! ด่าน 2 เสร็จสมบูรณ์!');
      } else {
        setError(response.data.message?.[language] || 'Incorrect flag');
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
                'Prove your identity through 3-Factor Authentication' :
                'พิสูจน์ตัวตนผ่านการยืนยัน 3 ปัจจัย'}
            </span>
          </TerminalLine>
        </div>

        {/* Status Display */}
        <div className="mt-3 grid grid-3">
          <div className={`card ${factors.email?.verified ? 'status-success' : ''}`}>
            <div className="text-center">
              <div className="text-cyan">FACTOR 1</div>
              <div className="text-white">Email OTP</div>
              <div>{factors.email?.verified ? '✓' : '○'}</div>
            </div>
          </div>
          <div className={`card ${factors.password?.verified ? 'status-success' : ''}`}>
            <div className="text-center">
              <div className="text-cyan">FACTOR 2</div>
              <div className="text-white">Password</div>
              <div>{factors.password?.verified ? '✓' : '○'}</div>
            </div>
          </div>
          <div className={`card ${factors.pin?.verified ? 'status-success' : ''}`}>
            <div className="text-center">
              <div className="text-cyan">FACTOR 3</div>
              <div className="text-white">PIN</div>
              <div>{factors.pin?.verified ? '✓' : '○'}</div>
            </div>
          </div>
        </div>

        {/* Factor 1: Email OTP */}
        {!factors.email?.verified && (
          <div className="mt-3 card">
            <div className="card-title">FACTOR 1: EMAIL OTP</div>
            <div className="card-content">
              <TerminalLine type="output">
                <span className="text-dim">
                  {language === 'en' ?
                    'Enter your email to receive a one-time password' :
                    'กรอกอีเมลเพื่อรับรหัสผ่านครั้งเดียว'}
                </span>
              </TerminalLine>

              {!otpSent ? (
                <>
                  <div className="form-group mt-2">
                    <input
                      type="email"
                      className="form-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={language === 'en' ? 'Enter email address' : 'กรอกอีเมล'}
                    />
                  </div>
                  <button className="btn" onClick={handleSendOTP} disabled={loading || !email}>
                    {loading ? 'SENDING...' : language === 'en' ? 'SEND OTP' : 'ส่ง OTP'}
                  </button>
                </>
              ) : (
                <>
                  <TerminalLine type="output">
                    <span className="text-green">
                      {language === 'en'
                        ? 'OTP has been sent to your email!'
                        : 'ส่ง OTP ไปที่อีเมลของคุณแล้ว!'}
                    </span>
                  </TerminalLine>
                  <div className="form-group mt-2">
                    <input
                      type="text"
                      className="form-input"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder={language === 'en' ? 'Enter 6-digit OTP' : 'กรอก OTP 6 หลัก'}
                      maxLength={6}
                    />
                  </div>
                  <button className="btn" onClick={handleVerifyOTP} disabled={loading || !otp}>
                    {loading ? 'VERIFYING...' : language === 'en' ? 'VERIFY OTP' : 'ยืนยัน OTP'}
                  </button>
                  <button className="btn btn-secondary ml-2" onClick={() => { setOtpSent(false); setDemoOTP(''); }}>
                    {language === 'en' ? 'RESEND' : 'ส่งใหม่'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Factor 2: Password */}
        {factors.email?.verified && !factors.password?.verified && (
          <div className="mt-3 card">
            <div className="card-title">FACTOR 2: PASSWORD</div>
            <div className="card-content">
              <TerminalLine type="output">
                <span className="text-dim">
                  {factors.password?.hint?.[language] || factors.password?.hint?.en ||
                    (language === 'en' ?
                      'Check your email for the scrambled password hint' :
                      'ดูคำใบ้รหัสผ่านแบบสลับตัวอักษรในอีเมล')}
                </span>
              </TerminalLine>
              <div className="form-group mt-2">
                <input
                  type="text"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={language === 'en' ? 'Enter password' : 'กรอกรหัสผ่าน'}
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
              <button className="btn" onClick={handleVerifyPassword} disabled={loading}>
                {loading ? 'VERIFYING...' : language === 'en' ? 'VERIFY PASSWORD' : 'ยืนยันรหัสผ่าน'}
              </button>
            </div>
          </div>
        )}

        {/* Factor 3: PIN */}
        {factors.password?.verified && !factors.pin?.verified && (
          <div className="mt-3 card">
            <div className="card-title">FACTOR 3: PIN</div>
            <div className="card-content">
              <TerminalLine type="output">
                <span className="text-dim">
                  {language === 'en'
                    ? 'Enter the 5-digit PIN to complete authentication'
                    : 'กรอก PIN 5 หลักเพื่อยืนยันตัวตน'}
                </span>
              </TerminalLine>
              <TerminalLine type="output">
                <span className="text-yellow">
                  {language === 'en' ? 'Attempts' : 'ครั้งที่ลอง'}: {factors.pin?.attempts || 0}/{factors.pin?.maxAttempts || 3}
                </span>
              </TerminalLine>
              <div className="form-group mt-2">
                <input
                  type="text"
                  className="form-input"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder={language === 'en' ? 'Enter 5-digit PIN' : 'กรอก PIN 5 หลัก'}
                  maxLength={5}
                />
              </div>
              <button className="btn" onClick={handleVerifyPin} disabled={loading}>
                {loading ? 'VERIFYING...' : language === 'en' ? 'VERIFY PIN' : 'ยืนยัน PIN'}
              </button>
            </div>
          </div>
        )}

        {/* MFA Complete - Show Flag */}
        {mfaComplete && (
          <div className="mt-3 card">
            <div className="card-title">
              {language === 'en' ? 'MFA COMPLETE!' : 'MFA เสร็จสมบูรณ์!'}
            </div>
            <div className="card-content">
              <TerminalLine type="output">
                <span className="text-green glow">
                  {language === 'en' ? 'All 3 factors verified!' : 'ยืนยันครบ 3 ปัจจัยแล้ว!'}
                </span>
              </TerminalLine>

              {flag && (
                <div className="mt-2 flag-display">
                  <div className="text-cyan">FLAG_2:</div>
                  <div className="text-green glow">{flag}</div>
                </div>
              )}

              {/* Flag Input Field */}
              <div className="mt-3">
                <TerminalLine type="output">
                  <span className="text-dim">
                    {language === 'en' ? 'Enter FLAG_2 to submit:' : 'กรอก FLAG_2 เพื่อส่ง:'}
                  </span>
                </TerminalLine>
                <div className="form-group mt-2">
                  <input
                    type="text"
                    className="form-input"
                    value={flagInput}
                    onChange={(e) => setFlagInput(e.target.value)}
                    placeholder="MUT{...}"
                  />
                </div>
                <button className="btn" onClick={handleSubmitFlag} disabled={loading || !flagInput}>
                  {loading ? 'SUBMITTING...' : language === 'en' ? 'SUBMIT FLAG_2' : 'ส่ง FLAG_2'}
                </button>
              </div>
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
                {language === 'en' ? 'PROCEED TO CHALLENGE 3' : 'ไปด่าน 3'}
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
            [ERROR] {typeof error === 'object' ? (error[language] || error.en || JSON.stringify(error)) : error}
          </TerminalLine>
        )}
      </Terminal>
    </div>
  );
}

export default Challenge2;
