import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Terminal, TerminalLine } from '../components/common/Terminal';
import { ChallengeProgress } from '../components/common/ChallengeProgress';
import api from '../services/api';

export function Challenge3() {
  const { language } = useLanguage();
  const { user, updateToken, refreshProgress } = useAuth();
  const navigate = useNavigate();

  const [whoami, setWhoami] = useState(null);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [flag, setFlag] = useState('');
  const [victory, setVictory] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!user?.progress?.challenge2) {
      navigate('/dashboard');
      return;
    }
    fetchWhoami();
    fetchResources();
  }, [user]);

  const fetchWhoami = async () => {
    try {
      const response = await api.get('/api/c3/whoami');
      setWhoami(response.data);
    } catch (err) {
      console.error('Whoami error:', err);
    }
  };

  const fetchResources = async () => {
    try {
      const response = await api.get('/api/c3/resources');
      setResources(response.data.resources || []);
    } catch (err) {
      console.error('Resources error:', err);
    }
  };

  const handleExploitDelegation = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post('/api/c3/request-access', {
        resource: 'project_alpha.txt',
        reason: 'Research collaboration'
      });
      setMessage(response.data.message?.[language] || response.data.message?.en || 'Access granted');
      await fetchWhoami();
      await fetchResources();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed');
    }
    setLoading(false);
  };

  const handleExploitAttribute = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post('/api/c3/attributes', {
        attribute: 'clearance_training',
        value: 'complete'
      });
      setMessage('Attribute updated: clearance_training = complete');
      await fetchWhoami();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed');
    }
    setLoading(false);
  };

  const handleTimeBypass = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.get('/api/c3/resources/8', {
        headers: { 'X-System-Time': '02:30' }
      });
      setMessage('Maintenance window bypass successful! File accessed.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed');
    }
    setLoading(false);
  };

  const handleDeclassify = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post('/api/c3/declassify', {
        resource: 'FINAL_FLAG.txt',
        requester_role: 'Director',
        reason: 'Audit review'
      });
      setMessage('Declassification approved! Top Secret file accessed.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed');
    }
    setLoading(false);
  };

  const handleGetFinalFlag = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/api/c3/final-flag');
      if (response.data.finalFlag) {
        setFlag(response.data.finalFlag);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Access the Top Secret file first');
    }
    setLoading(false);
  };

  const handleSubmitFlag = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/api/c3/submit-flag', { flag });
      if (response.data.victory) {
        setVictory(true);
        await refreshProgress();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed');
    }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!window.confirm(language === 'en'
      ? 'Are you sure you want to reset and start over? All progress will be lost.'
      : 'คุณแน่ใจหรือไม่ว่าต้องการรีเซ็ตและเริ่มใหม่? ความคืบหน้าทั้งหมดจะหายไป')) {
      return;
    }

    setResetting(true);
    try {
      const response = await api.post('/api/game/reset');
      if (response.data.sessionToken) {
        updateToken(response.data.sessionToken);
        await refreshProgress();
        navigate('/challenge/1');
      }
    } catch (err) {
      console.error('Reset failed:', err);
      alert(language === 'en' ? 'Failed to reset game' : 'รีเซ็ตเกมไม่สำเร็จ');
    }
    setResetting(false);
  };

  if (victory) {
    return (
      <div className="main-content">
        <Terminal title="victory.exe">
          <pre className="ascii-art text-green">
            {`
██╗   ██╗██╗ ██████╗████████╗ ██████╗ ██████╗ ██╗   ██╗
██║   ██║██║██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗╚██╗ ██╔╝
██║   ██║██║██║        ██║   ██║   ██║██████╔╝ ╚████╔╝
╚██╗ ██╔╝██║██║        ██║   ██║   ██║██╔══██╗  ╚██╔╝
 ╚████╔╝ ██║╚██████╗   ██║   ╚██████╔╝██║  ██║   ██║
  ╚═══╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝   ╚═╝
            `}
          </pre>

          <div className="text-center mt-3">
            <TerminalLine type="output">
              <span className="text-green glow">
                {language === 'en' ?
                  'CONGRATULATIONS! You have completed all challenges!' :
                  'ยินดีด้วย! คุณผ่านทุกด่านแล้ว!'}
              </span>
            </TerminalLine>

            <div className="mt-3">
              <TerminalLine type="output">
                {language === 'en' ? (
                  <>
                    You have demonstrated mastery of:
                    <br />✓ Diffie-Hellman Key Exchange
                    <br />✓ AES-256 Symmetric Encryption
                    <br />✓ RSA-2048 Digital Signatures
                    <br />✓ Multi-Factor Authentication
                    <br />✓ Access Control Exploitation
                  </>
                ) : (
                  <>
                    คุณได้แสดงความเชี่ยวชาญใน:
                    <br />✓ การแลกเปลี่ยนคีย์ Diffie-Hellman
                    <br />✓ การเข้ารหัส AES-256
                    <br />✓ ลายเซ็นดิจิทัล RSA-2048
                    <br />✓ การยืนยันตัวตนหลายปัจจัย
                    <br />✓ การใช้ประโยชน์จากการควบคุมการเข้าถึง
                  </>
                )}
              </TerminalLine>
            </div>

            <div className="mt-3 flag-display">
              <div className="text-cyan">FINAL FLAG:</div>
              <div className="text-green glow">{flag}</div>
            </div>

            <div className="mt-3" style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn" onClick={() => navigate('/dashboard')}>
                RETURN TO DASHBOARD
              </button>
              <button className="btn btn-warning" onClick={handleReset} disabled={resetting}>
                {resetting
                  ? (language === 'en' ? 'RESETTING...' : 'กำลังรีเซ็ต...')
                  : (language === 'en' ? 'RESET & PLAY AGAIN' : 'รีเซ็ตและเล่นใหม่')}
              </button>
            </div>
          </div>
        </Terminal>
      </div>
    );
  }

  return (
    <div className="main-content">
      <ChallengeProgress />

      <Terminal title="challenge_3_authorization.exe">
        <TerminalLine type="command" prompt="$">
          ./challenge_3 --start
        </TerminalLine>

        <div className="mt-2">
          <TerminalLine type="output">
            <span className="text-cyan">
              {language === 'en' ? 'CHAPTER 3: THE HIERARCHY OF SECRETS' : 'บทที่ 3: ลำดับชั้นแห่งความลับ'}
            </span>
          </TerminalLine>
          <TerminalLine type="output">
            <span className="text-dim">
              {language === 'en' ?
                'Navigate the access control labyrinth. Find and exploit the vulnerabilities.' :
                'นำทางผ่านเขาวงกตการควบคุมการเข้าถึง ค้นหาและใช้ประโยชน์จากช่องโหว่'}
            </span>
          </TerminalLine>
        </div>

        {/* Current Status */}
        <div className="mt-3 card">
          <div className="card-title">CURRENT STATUS</div>
          <div className="card-content">
            <TerminalLine type="output">
              Role: <span className="text-yellow">{whoami?.role?.name || 'Student'}</span>
            </TerminalLine>
            <TerminalLine type="output">
              Security Level: <span className="text-yellow">{whoami?.role?.securityLevel || 1}</span>
              {' '}({whoami?.role?.levelName?.[language] || whoami?.role?.levelName?.en || 'Public'})
            </TerminalLine>
            <TerminalLine type="output">
              Attributes: <span className="text-dim">{JSON.stringify(whoami?.attributes || {})}</span>
            </TerminalLine>
          </div>
        </div>

        {/* Role Hierarchy */}
        <div className="mt-3 card">
          <div className="card-title">ROLE HIERARCHY</div>
          <div className="card-content">
            <TerminalLine type="output">
              <span className="text-dim">Student (1)</span> →{' '}
              <span className="text-cyan">Researcher (2)</span> →{' '}
              <span className="text-yellow">Admin (3)</span> →{' '}
              <span className="text-green">Director (4)</span>
            </TerminalLine>
            <TerminalLine type="output">
              <span className="text-dim">Target: Access FINAL_FLAG.txt (Top Secret - Level 4)</span>
            </TerminalLine>
          </div>
        </div>

        {/* Vulnerabilities to Exploit */}
        <div className="mt-3 card">
          <div className="card-title">EXPLOITATION OPTIONS</div>
          <div className="card-content">
            <div className="grid grid-2">
              <div>
                <TerminalLine type="output">
                  <span className="text-yellow">1. Delegation Flaw</span>
                </TerminalLine>
                <TerminalLine type="output">
                  <span className="text-dim">Request access → Get role promotion</span>
                </TerminalLine>
                <button className="btn mt-1" onClick={handleExploitDelegation} disabled={loading}>
                  EXPLOIT DELEGATION
                </button>
              </div>

              <div>
                <TerminalLine type="output">
                  <span className="text-yellow">2. Attribute Injection</span>
                </TerminalLine>
                <TerminalLine type="output">
                  <span className="text-dim">Set clearance_training = complete</span>
                </TerminalLine>
                <button className="btn mt-1" onClick={handleExploitAttribute} disabled={loading}>
                  INJECT ATTRIBUTE
                </button>
              </div>

              <div>
                <TerminalLine type="output">
                  <span className="text-yellow">3. Time Header Bypass</span>
                </TerminalLine>
                <TerminalLine type="output">
                  <span className="text-dim">X-System-Time: 02:30 (maintenance)</span>
                </TerminalLine>
                <button className="btn mt-1" onClick={handleTimeBypass} disabled={loading}>
                  BYPASS TIME CHECK
                </button>
              </div>

              <div>
                <TerminalLine type="output">
                  <span className="text-yellow">4. Declassification Bug</span>
                </TerminalLine>
                <TerminalLine type="output">
                  <span className="text-dim">requester_role: "Director" (unvalidated)</span>
                </TerminalLine>
                <button className="btn mt-1" onClick={handleDeclassify} disabled={loading}>
                  REQUEST DECLASSIFY
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Get Final Flag */}
        <div className="mt-3 card">
          <div className="card-title">FINAL FLAG</div>
          <div className="card-content">
            <TerminalLine type="output">
              <span className="text-dim">
                After accessing the Top Secret file through any vulnerability:
              </span>
            </TerminalLine>
            <button className="btn mt-2" onClick={handleGetFinalFlag} disabled={loading}>
              GET FINAL FLAG
            </button>

            {flag && (
              <div className="mt-2">
                <div className="flag-display">
                  <div className="text-cyan">FINAL FLAG:</div>
                  <div className="text-green glow">{flag}</div>
                </div>
                <button className="btn mt-2" onClick={handleSubmitFlag} disabled={loading}>
                  SUBMIT FINAL FLAG
                </button>
              </div>
            )}
          </div>
        </div>

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

export default Challenge3;
