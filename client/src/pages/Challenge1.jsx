import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Terminal, TerminalLine } from '../components/common/Terminal';
import { ChallengeProgress } from '../components/common/ChallengeProgress';
import api from '../services/api';

export function Challenge1() {
  const { t, language } = useLanguage();
  const { user, updateToken, refreshProgress } = useAuth();
  const navigate = useNavigate();

  const [artifacts, setArtifacts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [flag, setFlag] = useState('');
  const [result, setResult] = useState(null);
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (user?.progress?.challenge1) {
      setStep(6); // Completed
    }
  }, [user]);

  const handleDownloadArtifacts = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/api/c1/artifacts');
      setArtifacts(response.data.artifacts);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to download artifacts');
    }
    setLoading(false);
  };

  const handleSubmitFlag = async () => {
    if (!flag.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await api.post('/api/c1/submit-flag', { flag: flag.trim() });
      setResult(response.data);

      if (response.data.correct) {
        if (response.data.newToken) {
          updateToken(response.data.newToken);
        }
        await refreshProgress();
        setStep(6);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit flag');
    }
    setLoading(false);
  };

  return (
    <div className="main-content">
      <ChallengeProgress />

      <Terminal title="challenge_1_cryptography.exe">
        <TerminalLine type="command" prompt="$">
          ./challenge_1 --start
        </TerminalLine>

        <div className="mt-2">
          <TerminalLine type="output">
            <span className="text-cyan text-bold">
              {language === 'en' ? 'CHAPTER 1: THE ENCRYPTED LEGACY' : 'บทที่ 1: มรดกที่ถูกเข้ารหัส'}
            </span>
          </TerminalLine>

          <TerminalLine type="output">
            <span className="text-dim">
              {language === 'en' ? (
                'The ancient vault contains secrets encrypted in 1990. Master the cryptographic arts to decode them.'
              ) : (
                'ห้องนิรภัยโบราณเก็บความลับที่ถูกเข้ารหัสในปี 2533 เชี่ยวชาญศาสตร์การเข้ารหัสเพื่อถอดรหัส'
              )}
            </span>
          </TerminalLine>
        </div>

        {/* Steps */}
        <div className="mt-3">
          <TerminalLine type="output">
            <span className="text-yellow">OBJECTIVES:</span>
          </TerminalLine>
          <TerminalLine type="output">
            {step >= 2 ? '✓' : '○'} 1. Download cryptographic artifacts
          </TerminalLine>
          <TerminalLine type="output">
            {step >= 3 ? '✓' : '○'} 2. Perform Diffie-Hellman key exchange
          </TerminalLine>
          <TerminalLine type="output">
            {step >= 4 ? '✓' : '○'} 3. Derive AES key and decrypt message
          </TerminalLine>
          <TerminalLine type="output">
            {step >= 5 ? '✓' : '○'} 4. Verify RSA signature
          </TerminalLine>
          <TerminalLine type="output">
            {step >= 6 ? '✓' : '○'} 5. Generate and submit FLAG_1
          </TerminalLine>
        </div>

        {/* Step 1: Download Artifacts */}
        {step === 1 && (
          <div className="mt-3">
            <button
              className="btn"
              onClick={handleDownloadArtifacts}
              disabled={loading}
            >
              {loading ? 'DOWNLOADING...' : 'DOWNLOAD ARTIFACTS'}
            </button>
          </div>
        )}

        {/* Artifacts Display */}
        {artifacts && (
          <div className="mt-3">
            <TerminalLine type="output">
              <span className="text-green">[ARTIFACTS DOWNLOADED]</span>
            </TerminalLine>

            <div className="code-block mt-2">
              <TerminalLine type="output">
                <span className="text-yellow">Diffie-Hellman Parameters:</span>
              </TerminalLine>
              <TerminalLine type="output">
                <span className="text-dim">Prime (p):</span> {artifacts.diffieHellman?.prime?.substring(0, 64)}...
              </TerminalLine>
              <TerminalLine type="output">
                <span className="text-dim">Generator (g):</span> {artifacts.diffieHellman?.generator}
              </TerminalLine>
              <TerminalLine type="output">
                <span className="text-cyan">Hint:</span> {artifacts.diffieHellman?.hint?.[language] || artifacts.diffieHellman?.hint?.en}
              </TerminalLine>
            </div>

            <div className="code-block mt-2">
              <TerminalLine type="output">
                <span className="text-yellow">RSA Public Key:</span>
              </TerminalLine>
              <TerminalLine type="output">
                <span className="text-dim">{artifacts.rsa?.publicKey?.substring(0, 100)}...</span>
              </TerminalLine>
            </div>

            <div className="code-block mt-2">
              <TerminalLine type="output">
                <span className="text-yellow">AES IV:</span> {artifacts.aes?.iv}
              </TerminalLine>
              <TerminalLine type="output">
                <span className="text-cyan">Hint:</span> {artifacts.aes?.hint?.[language] || artifacts.aes?.hint?.en}
              </TerminalLine>
            </div>
          </div>
        )}

        {/* API Info */}
        {artifacts && step < 6 && (
          <div className="mt-3 card">
            <div className="card-title">API SERVER</div>
            <div className="card-content">
              <TerminalLine type="output">
                <span className="text-cyan">Base URL: </span>
                <span className="text-yellow">http://localhost:3001</span>
              </TerminalLine>
              <TerminalLine type="output">
                <span className="text-dim">
                  {language === 'en'
                    ? 'Use curl, Postman, or any HTTP client to call the API'
                    : 'ใช้ curl, Postman หรือ HTTP client ใดก็ได้ในการเรียก API'}
                </span>
              </TerminalLine>
            </div>
          </div>
        )}

        {/* Easy Mode Hint */}
        {artifacts && step < 6 && (
          <div className="mt-3 card" style={{ borderColor: 'var(--text-green)' }}>
            <div className="card-title" style={{ color: 'var(--text-green)' }}>
              {language === 'en' ? 'EASY MODE' : 'โหมดง่าย'}
            </div>
            <div className="card-content">
              <TerminalLine type="output">
                <span className="text-green">
                  {language === 'en'
                    ? 'Try: GET /api/c1/easy-decrypt'
                    : 'ลอง: GET /api/c1/easy-decrypt'}
                </span>
              </TerminalLine>
              <TerminalLine type="output">
                <span className="text-dim">
                  {language === 'en'
                    ? 'This endpoint will help you skip the complex cryptography steps.'
                    : 'endpoint นี้จะช่วยข้ามขั้นตอน cryptography ที่ซับซ้อน'}
                </span>
              </TerminalLine>
            </div>
          </div>
        )}

        {/* Hard Mode Instructions */}
        {artifacts && step < 6 && (
          <div className="mt-3 card">
            <div className="card-title">
              {language === 'en' ? 'HARD MODE (Manual cryptography)' : 'โหมดยาก (ทำ cryptography เอง)'}
            </div>
            <div className="card-content">
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
                {language === 'en' ? `
1. Generate your DH private key (random number)
2. Compute public key: A = g^a mod p
3. POST /api/c1/dh/exchange with your public key
4. Compute shared secret: S = server_public^a mod p
5. Derive AES key: SHA256(shared_secret + "SUT1990")[:32]
6. GET /api/c1/encrypted - decrypt with AES-256-CBC
7. GET /api/c1/signature - verify with RSA public key
8. FLAG_1 = MUT{SHA256(message + "1990" + signature)[:32]}
                ` : `
1. สร้าง DH private key (ตัวเลขสุ่ม)
2. คำนวณ public key: A = g^a mod p
3. POST /api/c1/dh/exchange พร้อม public key ของคุณ
4. คำนวณ shared secret: S = server_public^a mod p
5. สร้าง AES key: SHA256(shared_secret + "SUT1990")[:32]
6. GET /api/c1/encrypted - ถอดรหัสด้วย AES-256-CBC
7. GET /api/c1/signature - ตรวจสอบด้วย RSA public key
8. FLAG_1 = MUT{SHA256(message + "1990" + signature)[:32]}
                `}
              </pre>
            </div>
          </div>
        )}

        {/* Flag Submission */}
        {artifacts && step < 6 && (
          <div className="mt-3">
            <div className="form-group">
              <label className="form-label">SUBMIT FLAG_1</label>
              <input
                type="text"
                className="form-input"
                value={flag}
                onChange={(e) => setFlag(e.target.value)}
                placeholder="MUT{...}"
              />
            </div>
            <button
              className="btn"
              onClick={handleSubmitFlag}
              disabled={loading || !flag.trim()}
            >
              {loading ? 'VALIDATING...' : 'SUBMIT FLAG'}
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-3">
            {result.correct ? (
              <div className="flag-display">
                <TerminalLine type="output">
                  <span className="text-green glow">FLAG_1 CORRECT!</span>
                </TerminalLine>
                <TerminalLine type="output">
                  {result.message?.[language] || result.message?.en}
                </TerminalLine>
                <div className="mt-2">
                  <button className="btn" onClick={() => navigate('/challenge/2')}>
                    PROCEED TO CHALLENGE 2
                  </button>
                </div>
              </div>
            ) : (
              <TerminalLine type="error">
                INCORRECT FLAG. {result.hint?.[language] || result.hint?.en}
              </TerminalLine>
            )}
          </div>
        )}

        {/* Completed */}
        {step === 6 && !result && (
          <div className="mt-3 flag-display">
            <TerminalLine type="output">
              <span className="text-green glow">CHALLENGE 1 COMPLETE</span>
            </TerminalLine>
            <div className="mt-2">
              <button className="btn" onClick={() => navigate('/challenge/2')}>
                PROCEED TO CHALLENGE 2
              </button>
            </div>
          </div>
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

export default Challenge1;
