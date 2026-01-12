import React, { useState, useEffect } from 'react';
import { TerminalLine } from './common/Terminal';

export function ClueHunter({ artifacts, responseHeaders, language, api, onUnlock }) {
  const [keyword, setKeyword] = useState('');
  const [fragments, setFragments] = useState({
    f1: '', // From _vault_data (Base64)
    f2: '', // From HTTP header (Base64)
    f3: '', // From RSA _debug (Hex)
    f4: '', // Plain "19"
    f5: '', // From DH _metadata (Base64)
  });
  const [hints, setHints] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHints, setShowHints] = useState(false);

  // Auto-extract fragments from artifacts when available
  useEffect(() => {
    if (artifacts) {
      // Fragment 1: from _vault_data
      const f1Raw = artifacts._vault_data?.fragment1 || '';

      // Fragment 5: from DH _metadata
      const f5Raw = artifacts.diffieHellman?._metadata?.fragment5 || '';

      // Fragment 3: from RSA _debug
      const f3Raw = artifacts.rsa?._debug?.hex_fragment3 || '';

      // Log hints for fragment 4 to console
      if (artifacts.aes?._console_hint) {
        console.log('%c[VAULT HINT] ' + artifacts.aes._console_hint, 'color: #00ff00; font-weight: bold;');
        console.log('%c[FRAGMENT 4] The year 1990 splits into: "19" and "90"', 'color: #ffff00;');
      }

      setFragments(prev => ({
        ...prev,
        f1: f1Raw,
        f3: f3Raw,
        f5: f5Raw,
      }));
    }
  }, [artifacts]);

  // Fetch hints
  const fetchHints = async () => {
    try {
      const response = await api.get('/api/c1/puzzle-hint');
      setHints(response.data);
      setShowHints(true);
    } catch (err) {
      setError('Failed to fetch hints');
    }
  };

  // Decode Base64
  const decodeBase64 = (str) => {
    try {
      return atob(str);
    } catch {
      return '[Invalid Base64]';
    }
  };

  // Decode Hex
  const decodeHex = (hex) => {
    try {
      let str = '';
      for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
      }
      return str;
    } catch {
      return '[Invalid Hex]';
    }
  };

  // Build keyword from fragments
  const buildKeyword = () => {
    const decoded1 = fragments.f1 ? decodeBase64(fragments.f1) : '';
    const decoded2 = fragments.f2 ? decodeBase64(fragments.f2) : '';
    const decoded3 = fragments.f3 ? decodeHex(fragments.f3) : '';
    const decoded4 = fragments.f4 || '';
    const decoded5 = fragments.f5 ? decodeBase64(fragments.f5) : '';

    return decoded1 + decoded2 + decoded3 + decoded4 + decoded5;
  };

  // Auto-fill keyword
  const autoFillKeyword = () => {
    setKeyword(buildKeyword());
  };

  // Verify keyword
  const verifyKeyword = async () => {
    if (!keyword.trim()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/api/c1/verify-keyword', { keyword: keyword.trim() });

      if (response.data.unlocked) {
        setSuccess(response.data.message?.[language] || response.data.message?.en);
        if (onUnlock) onUnlock();
      }
    } catch (err) {
      setError(err.response?.data?.message?.[language] || err.response?.data?.message?.en || 'Verification failed');
    }

    setLoading(false);
  };

  return (
    <div className="mt-3 card" style={{ borderColor: 'var(--text-yellow)' }}>
      <div className="card-title" style={{ color: 'var(--text-yellow)' }}>
        {language === 'en' ? 'VAULT KEYWORD PUZZLE' : 'ปริศนารหัสห้องนิรภัย'}
      </div>
      <div className="card-content">
        <TerminalLine type="output">
          <span className="text-dim">
            {language === 'en'
              ? 'Find 5 hidden fragments to unlock the Crypto Calculator. Check API responses, HTTP headers, and encoded data.'
              : 'ค้นหา 5 fragments ที่ซ่อนอยู่เพื่อปลดล็อก Crypto Calculator ตรวจสอบ API responses, HTTP headers และ encoded data'}
          </span>
        </TerminalLine>

        {/* Hint Button */}
        <div className="mt-2">
          <button className="btn btn-small btn-cyan" onClick={fetchHints}>
            {language === 'en' ? 'GET HINTS' : 'ดูคำใบ้'}
          </button>
        </div>

        {/* Show Hints */}
        {showHints && hints && (
          <div className="code-block mt-2" style={{ background: 'rgba(0,255,255,0.1)' }}>
            <TerminalLine type="output">
              <span className="text-cyan">{hints.title?.[language] || hints.title?.en}</span>
            </TerminalLine>
            {hints.fragments?.map((f, idx) => (
              <div key={idx} style={{ marginTop: '0.5rem', paddingLeft: '1rem' }}>
                <TerminalLine type="output">
                  <span className="text-yellow">Fragment {f.id}:</span>
                  <span className="text-dim"> [{f.encoding}]</span>
                </TerminalLine>
                <TerminalLine type="output">
                  <span className="text-dim">{f.location?.[language] || f.location?.en}</span>
                </TerminalLine>
                <TerminalLine type="output">
                  <span className="text-green">Hint: {f.hint?.[language] || f.hint?.en}</span>
                </TerminalLine>
              </div>
            ))}
          </div>
        )}

        {/* Fragment Inputs */}
        <div className="mt-3">
          <TerminalLine type="output">
            <span className="text-yellow">{language === 'en' ? 'Enter Found Fragments:' : 'กรอก Fragments ที่พบ:'}</span>
          </TerminalLine>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
            <div>
              <label className="form-label text-dim">Fragment 1 (Base64):</label>
              <input
                type="text"
                className="form-input"
                value={fragments.f1}
                onChange={(e) => setFragments({ ...fragments, f1: e.target.value })}
                placeholder="e.g., U1VS"
                style={{ fontSize: '0.85rem' }}
              />
              {fragments.f1 && (
                <span className="text-green" style={{ fontSize: '0.75rem' }}>
                  = {decodeBase64(fragments.f1)}
                </span>
              )}
            </div>

            <div>
              <label className="form-label text-dim">Fragment 2 (Base64 from Header):</label>
              <input
                type="text"
                className="form-input"
                value={fragments.f2}
                onChange={(e) => setFragments({ ...fragments, f2: e.target.value })}
                placeholder="Check X-Vault-Fragment header"
                style={{ fontSize: '0.85rem' }}
              />
              {fragments.f2 && (
                <span className="text-green" style={{ fontSize: '0.75rem' }}>
                  = {decodeBase64(fragments.f2)}
                </span>
              )}
            </div>

            <div>
              <label className="form-label text-dim">Fragment 3 (Hex):</label>
              <input
                type="text"
                className="form-input"
                value={fragments.f3}
                onChange={(e) => setFragments({ ...fragments, f3: e.target.value })}
                placeholder="e.g., 524545"
                style={{ fontSize: '0.85rem' }}
              />
              {fragments.f3 && (
                <span className="text-green" style={{ fontSize: '0.75rem' }}>
                  = {decodeHex(fragments.f3)}
                </span>
              )}
            </div>

            <div>
              <label className="form-label text-dim">Fragment 4 (Plain):</label>
              <input
                type="text"
                className="form-input"
                value={fragments.f4}
                onChange={(e) => setFragments({ ...fragments, f4: e.target.value })}
                placeholder="First half of 1990"
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label text-dim">Fragment 5 (Base64):</label>
              <input
                type="text"
                className="form-input"
                value={fragments.f5}
                onChange={(e) => setFragments({ ...fragments, f5: e.target.value })}
                placeholder="e.g., OTA="
                style={{ fontSize: '0.85rem' }}
              />
              {fragments.f5 && (
                <span className="text-green" style={{ fontSize: '0.75rem' }}>
                  = {decodeBase64(fragments.f5)}
                </span>
              )}
            </div>
          </div>

          <div className="mt-2">
            <button className="btn btn-small" onClick={autoFillKeyword}>
              {language === 'en' ? 'COMBINE FRAGMENTS' : 'รวม FRAGMENTS'}
            </button>
          </div>
        </div>

        {/* Keyword Input */}
        <div className="mt-3">
          <TerminalLine type="output">
            <span className="text-yellow">{language === 'en' ? 'Enter Complete Keyword:' : 'กรอกรหัสเต็ม:'}</span>
          </TerminalLine>
          <div className="form-group mt-1">
            <input
              type="text"
              className="form-input"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={language === 'en' ? 'Combined keyword from all fragments' : 'รหัสที่รวมจากทุก fragments'}
              style={{ textTransform: 'uppercase', letterSpacing: '2px' }}
            />
          </div>
          <button
            className="btn"
            onClick={verifyKeyword}
            disabled={loading || !keyword.trim()}
          >
            {loading ? 'VERIFYING...' : (language === 'en' ? 'UNLOCK VAULT' : 'ปลดล็อกห้องนิรภัย')}
          </button>
        </div>

        {/* Status Messages */}
        {error && (
          <TerminalLine type="error" className="mt-2">
            [ERROR] {error}
          </TerminalLine>
        )}

        {success && (
          <div className="mt-2 flag-display">
            <TerminalLine type="output">
              <span className="text-green glow">[UNLOCKED] {success}</span>
            </TerminalLine>
          </div>
        )}
      </div>
    </div>
  );
}

export default ClueHunter;
