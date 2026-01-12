import React, { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import { TerminalLine } from './common/Terminal';

// BigInt modular exponentiation
function modPow(base, exp, mod) {
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % mod;
    }
    exp = exp / 2n;
    base = (base * base) % mod;
  }
  return result;
}

// Convert hex string to BigInt
function hexToBigInt(hex) {
  return BigInt('0x' + hex);
}

// Convert BigInt to hex string
function bigIntToHex(num) {
  let hex = num.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  return hex;
}

// Hex to bytes array
function hexToBytes(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

// Bytes to WordArray for CryptoJS
function bytesToWordArray(bytes) {
  return CryptoJS.lib.WordArray.create(bytes);
}

// Caesar cipher decoder
function caesarDecode(text, shift) {
  return text.split('').map(char => {
    if (char >= 'A' && char <= 'Z') {
      return String.fromCharCode(((char.charCodeAt(0) - 65 - shift + 26) % 26) + 65);
    } else if (char >= 'a' && char <= 'z') {
      return String.fromCharCode(((char.charCodeAt(0) - 97 - shift + 26) % 26) + 97);
    } else if (char >= '0' && char <= '9') {
      return String.fromCharCode(((char.charCodeAt(0) - 48 - shift + 10) % 10) + 48);
    }
    return char;
  }).join('');
}

export function CryptoCalculator({ artifacts, language, api, onStepComplete }) {
  const [privateKey, setPrivateKey] = useState('');
  const [calculatedPublicKey, setCalculatedPublicKey] = useState('');
  const [serverPublicKey, setServerPublicKey] = useState('');
  const [sharedSecret, setSharedSecret] = useState('');
  const [salt, setSalt] = useState('');
  const [saltVerified, setSaltVerified] = useState(false);
  const [calculatedAesKey, setCalculatedAesKey] = useState(''); // Auto-calculated from salt
  const [aesKey, setAesKey] = useState(''); // User input for verification
  const [encryptedData, setEncryptedData] = useState('');
  const [decryptedMessage, setDecryptedMessage] = useState('');
  const [signature, setSignature] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1: Calculate DH Public Key
  const calculatePublicKey = () => {
    try {
      setError('');
      const p = hexToBigInt(artifacts.diffieHellman.prime);
      const g = hexToBigInt(artifacts.diffieHellman.generator);
      const a = BigInt(privateKey);

      if (a <= 1n || a >= p - 1n) {
        setError('Private key must be between 2 and p-2');
        return;
      }

      const A = modPow(g, a, p);
      setCalculatedPublicKey(bigIntToHex(A));
      setStep(2);
      if (onStepComplete) onStepComplete(2);
    } catch (err) {
      setError('Invalid private key: ' + err.message);
    }
  };

  // Step 2: DH Exchange with server
  const performDHExchange = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.post('/api/c1/dh/exchange', {
        clientPublicKey: calculatedPublicKey
      });

      setServerPublicKey(response.data.serverPublicKey);

      // Calculate shared secret
      const p = hexToBigInt(artifacts.diffieHellman.prime);
      const B = hexToBigInt(response.data.serverPublicKey);
      const a = BigInt(privateKey);

      const S = modPow(B, a, p);
      setSharedSecret(bigIntToHex(S));
      setStep(3);
      if (onStepComplete) onStepComplete(3);
    } catch (err) {
      setError('DH Exchange failed: ' + (err.response?.data?.message || err.message));
    }
    setLoading(false);
  };

  // Step 3a: Calculate AES key from salt (no verification - will know if wrong at decrypt step)
  const calculateAesKeyFromSalt = () => {
    if (!salt.trim()) return;

    setError('');

    // Calculate AES key: SHA256(shared_secret + salt)
    const dataToHash = sharedSecret + salt.trim();
    const hash = CryptoJS.SHA256(dataToHash);
    const calculatedKey = hash.toString(CryptoJS.enc.Hex).substring(0, 64);
    setCalculatedAesKey(calculatedKey);
    setSaltVerified(true); // Just mark as "entered", not verified

    // Move to step 4 immediately (show both steps)
    setStep(4);
    if (onStepComplete) onStepComplete(4);
  };

  // Auto-decode Caesar cipher helper
  const autoDecodeCaesar = () => {
    const cipherText = artifacts?.aes?._cipher_puzzle?.cipherText || 'jlirerivv';
    const shift = artifacts?.aes?._cipher_puzzle?.shift || 17;
    const decoded = caesarDecode(cipherText, shift);
    setSalt(decoded);
  };

  // Auto-fetch encrypted data when step 4 is reached
  useEffect(() => {
    if (step === 4 && !encryptedData && saltVerified) {
      fetchEncryptedData();
    }
  }, [step, saltVerified]);

  // Step 4a: Fetch encrypted data
  const fetchEncryptedData = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get('/api/c1/encrypted');
      const encrypted = response.data.encrypted;
      setEncryptedData(encrypted.data);
    } catch (err) {
      setError('Failed to fetch encrypted data: ' + (err.response?.data?.message || err.message));
    }
    setLoading(false);
  };

  // Step 4b: Decrypt with user-provided key
  const decryptWithKey = () => {
    try {
      setError('');

      if (!aesKey || aesKey.length !== 64) {
        setError('Please enter a valid AES key (64 hex characters)');
        return;
      }

      // Decrypt with AES-256-CBC
      const iv = CryptoJS.enc.Hex.parse(artifacts.aes.iv);
      const key = CryptoJS.enc.Hex.parse(aesKey);
      const ciphertext = CryptoJS.enc.Hex.parse(encryptedData);

      const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: ciphertext
      });

      const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      let plaintext = '';
      try {
        plaintext = decrypted.toString(CryptoJS.enc.Utf8);
      } catch (e) {
        // If UTF-8 decode fails, show hex representation
        plaintext = decrypted.toString(CryptoJS.enc.Hex);
      }

      // Show result even if empty or garbage - user will see if it's readable
      if (!plaintext || plaintext.length === 0) {
        // Try to show as hex if UTF-8 failed completely
        plaintext = '[Empty or binary data - wrong key?]';
      }

      setDecryptedMessage(plaintext);

      // Check if plaintext looks readable:
      // 1. Not just hex characters (0-9, a-f)
      // 2. Contains spaces (real sentences have spaces)
      // 3. Contains letters (not just symbols/numbers)
      const isOnlyHex = /^[0-9a-fA-F]+$/.test(plaintext);
      const hasSpaces = /\s/.test(plaintext);
      const hasLetters = /[a-zA-Z\u0E00-\u0E7F]/.test(plaintext);
      const isPrintable = /^[\x20-\x7E\u0E00-\u0E7F\s]+$/.test(plaintext);

      const isReadable = !isOnlyHex && hasSpaces && hasLetters && isPrintable && plaintext.length > 10;

      if (isReadable) {
        setStep(5);
        if (onStepComplete) onStepComplete(5);
      }
      // If not readable, user can go back and fix salt
    } catch (err) {
      setDecryptedMessage('[Decryption error: ' + err.message + ']');
    }
  };

  // Step 5: Get RSA signature (just fetch, don't auto-proceed)
  const fetchSignature = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get('/api/c1/signature');
      const sig = response.data.signature.data;
      setSignature(sig);
      // Don't auto-proceed to step 6 - user needs to generate flag themselves
    } catch (err) {
      setError('Signature fetch failed: ' + (err.response?.data?.message || err.message));
    }
    setLoading(false);
  };

  return (
    <div className="mt-3 card" style={{ borderColor: 'var(--text-magenta)' }}>
      <div className="card-title" style={{ color: 'var(--text-magenta)' }}>
        {language === 'en' ? 'CRYPTO CALCULATOR' : 'เครื่องคำนวณ CRYPTO'}
      </div>
      <div className="card-content">

        {/* Step 1: Enter Private Key */}
        <div className="code-block mt-2">
          <TerminalLine type="output">
            <span className="text-yellow">Step 1: Diffie-Hellman Key Generation</span>
          </TerminalLine>
          <div className="form-group mt-1">
            <label className="form-label">
              {language === 'en' ? 'Enter your private key (a) - any large number:' : 'กรอก private key (a) - ตัวเลขขนาดใหญ่:'}
            </label>
            <input
              type="text"
              className="form-input"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="e.g., 123456789"
              style={{ fontFamily: 'monospace' }}
            />
          </div>
          <button
            className="btn btn-small mt-1"
            onClick={calculatePublicKey}
            disabled={!privateKey}
          >
            {language === 'en' ? 'Calculate Public Key (A = g^a mod p)' : 'คำนวณ Public Key (A = g^a mod p)'}
          </button>

          {calculatedPublicKey && (
            <div className="mt-1">
              <TerminalLine type="output">
                <span className="text-green">Your Public Key (A):</span>
              </TerminalLine>
              <TerminalLine type="output">
                <span className="text-dim" style={{ wordBreak: 'break-all', fontSize: '0.75rem' }}>
                  {calculatedPublicKey.substring(0, 64)}...
                </span>
              </TerminalLine>
            </div>
          )}
        </div>

        {/* Step 2: DH Exchange */}
        {step >= 2 && (
          <div className="code-block mt-2">
            <TerminalLine type="output">
              <span className="text-yellow">Step 2: DH Key Exchange</span>
            </TerminalLine>
            <button
              className="btn btn-small mt-1"
              onClick={performDHExchange}
              disabled={loading || sharedSecret}
            >
              {loading ? 'EXCHANGING...' : (language === 'en' ? 'Send to Server & Compute Shared Secret' : 'ส่งไป Server และคำนวณ Shared Secret')}
            </button>

            {sharedSecret && (
              <div className="mt-1">
                <TerminalLine type="output">
                  <span className="text-green">Server Public Key (B):</span>
                </TerminalLine>
                <TerminalLine type="output">
                  <span className="text-dim" style={{ wordBreak: 'break-all', fontSize: '0.75rem' }}>
                    {serverPublicKey.substring(0, 64)}...
                  </span>
                </TerminalLine>
                <TerminalLine type="output">
                  <span className="text-green">Shared Secret (S = B^a mod p):</span>
                </TerminalLine>
                <TerminalLine type="output">
                  <span className="text-cyan" style={{ wordBreak: 'break-all', fontSize: '0.75rem' }}>
                    {sharedSecret.substring(0, 64)}...
                  </span>
                </TerminalLine>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Caesar Cipher Puzzle + AES Key Derivation */}
        {step >= 3 && (
          <div className="code-block mt-2">
            <TerminalLine type="output">
              <span className="text-yellow">Step 3: Caesar Cipher Puzzle + AES Key Derivation</span>
            </TerminalLine>

            {/* Caesar Cipher Puzzle */}
            {!saltVerified && (
              <div style={{ background: 'rgba(255,255,0,0.1)', padding: '0.5rem', borderRadius: '4px', marginTop: '0.5rem' }}>
                <TerminalLine type="output">
                  <span className="text-yellow">PUZZLE: Decode the Caesar Cipher to find the salt</span>
                </TerminalLine>
                <TerminalLine type="output">
                  <span className="text-cyan">Cipher Text: </span>
                  <span className="text-white" style={{ fontWeight: 'bold', letterSpacing: '2px' }}>
                    {artifacts?.aes?._cipher_puzzle?.cipherText || 'jlirerivv'}
                  </span>
                </TerminalLine>
                <div className="form-group mt-1">
                  <label className="form-label">
                    {language === 'en' ? 'Enter decoded salt:' : 'กรอก salt ที่ถอดรหัสแล้ว:'}
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={salt}
                      onChange={(e) => setSalt(e.target.value.toLowerCase())}
                      placeholder="?????????"
                      style={{ fontFamily: 'monospace', letterSpacing: '2px', flex: 1 }}
                      maxLength={9}
                    />
                    <button
                      className="btn btn-small btn-cyan"
                      onClick={autoDecodeCaesar}
                      title="Auto decode"
                    >
                      ?
                    </button>
                  </div>
                </div>

                <button
                  className="btn btn-small mt-1"
                  onClick={calculateAesKeyFromSalt}
                  disabled={!salt.trim()}
                >
                  {language === 'en' ? 'Calculate AES Key' : 'คำนวณ AES Key'}
                </button>
              </div>
            )}

            {/* Salt entered - Show calculated AES Key */}
            {saltVerified && (
              <div style={{ background: 'rgba(0,255,255,0.1)', padding: '0.5rem', borderRadius: '4px', marginTop: '0.5rem' }}>
                <TerminalLine type="output">
                  <span className="text-cyan">Salt entered: {salt}</span>
                  <button
                    className="btn btn-small"
                    style={{ marginLeft: '1rem', padding: '0.1rem 0.5rem', fontSize: '0.7rem' }}
                    onClick={() => {
                      setSaltVerified(false);
                      setCalculatedAesKey('');
                      setAesKey('');
                      setDecryptedMessage('');
                      setStep(3);
                    }}
                  >
                    {language === 'en' ? 'Edit Salt' : 'แก้ไข Salt'}
                  </button>
                </TerminalLine>
                <TerminalLine type="output">
                  <span className="text-dim">Formula: AES Key = SHA256(shared_secret + "{salt}")[:64 hex]</span>
                </TerminalLine>
                <TerminalLine type="output">
                  <span className="text-yellow">Calculated AES Key:</span>
                </TerminalLine>
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  fontSize: '0.75rem',
                  color: 'var(--text-green)',
                  background: 'rgba(0,0,0,0.3)',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  marginTop: '0.25rem',
                  userSelect: 'all',
                  cursor: 'pointer'
                }} title="Click to select">
                  {calculatedAesKey}
                </pre>
                <TerminalLine type="output">
                  <span className="text-dim" style={{ fontSize: '0.75rem' }}>
                    {language === 'en'
                      ? '↑ Copy this key and paste in Step 4. If decryption shows readable text, your salt was correct!'
                      : '↑ คัดลอก key นี้ไปวางใน Step 4 ถ้าถอดรหัสแล้วอ่านได้ แสดงว่า salt ถูกต้อง!'}
                  </span>
                </TerminalLine>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Decrypt */}
        {step >= 4 && (
          <div className="code-block mt-2">
            <TerminalLine type="output">
              <span className="text-yellow">Step 4: AES-256-CBC Decryption</span>
            </TerminalLine>

            {/* Loading state */}
            {!encryptedData && loading && (
              <TerminalLine type="output">
                <span className="text-dim">Loading encrypted data...</span>
              </TerminalLine>
            )}

            {/* Show encrypted data */}
            {encryptedData && !decryptedMessage && (
              <div style={{ background: 'rgba(255,0,0,0.1)', padding: '0.5rem', borderRadius: '4px', marginTop: '0.5rem' }}>
                <TerminalLine type="output">
                  <span className="text-red">Encrypted Data (Ciphertext):</span>
                </TerminalLine>
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  fontSize: '0.7rem',
                  color: 'var(--text-dim)',
                  background: 'rgba(0,0,0,0.3)',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  marginTop: '0.5rem',
                  maxHeight: '100px',
                  overflow: 'auto'
                }}>
                  {encryptedData}
                </pre>

                {/* AES Key input */}
                <div className="form-group mt-2">
                  <label className="form-label">
                    {language === 'en' ? 'Enter AES-256 Key from Step 3 to verify:' : 'กรอก AES-256 Key จาก Step 3 เพื่อตรวจสอบ:'}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={aesKey}
                    onChange={(e) => setAesKey(e.target.value.toLowerCase().replace(/[^0-9a-f]/g, ''))}
                    placeholder={language === 'en' ? 'Paste the AES key from Step 3...' : 'วาง AES key จาก Step 3...'}
                    style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                    maxLength={64}
                  />
                  <span className="text-dim" style={{ fontSize: '0.7rem' }}>
                    {aesKey.length}/64 characters
                    {aesKey.length === 64 && <span className="text-green"> ✓</span>}
                  </span>
                </div>

                <TerminalLine type="output">
                  <span className="text-dim" style={{ fontSize: '0.75rem' }}>
                    {language === 'en'
                      ? 'Copy the AES key from Step 3 above and paste here to decrypt'
                      : 'คัดลอก AES key จาก Step 3 ด้านบนมาวางที่นี่เพื่อถอดรหัส'}
                  </span>
                </TerminalLine>

                <button
                  className="btn btn-small mt-1"
                  onClick={decryptWithKey}
                  disabled={aesKey.length !== 64}
                >
                  {language === 'en' ? 'Decrypt & Verify' : 'ถอดรหัสและตรวจสอบ'}
                </button>
              </div>
            )}

            {/* Show decrypted message */}
            {decryptedMessage && (() => {
              // Check if plaintext looks readable
              const isOnlyHex = /^[0-9a-fA-F]+$/.test(decryptedMessage);
              const hasSpaces = /\s/.test(decryptedMessage);
              const hasLetters = /[a-zA-Z\u0E00-\u0E7F]/.test(decryptedMessage);
              const isPrintable = /^[\x20-\x7E\u0E00-\u0E7F\s]+$/.test(decryptedMessage);
              const isReadable = !isOnlyHex && hasSpaces && hasLetters && isPrintable && decryptedMessage.length > 10;
              return (
                <div style={{
                  background: isReadable ? 'rgba(0,255,0,0.1)' : 'rgba(255,0,0,0.1)',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  marginTop: '0.5rem'
                }}>
                  <TerminalLine type="output">
                    <span className={isReadable ? 'text-green' : 'text-red'}>
                      {isReadable
                        ? (language === 'en' ? 'Decrypted Message (Readable!):' : 'ข้อความที่ถอดรหัส (อ่านได้!):')
                        : (language === 'en' ? 'Decrypted Result (Garbage - wrong salt/key?):' : 'ผลการถอดรหัส (อ่านไม่ได้ - salt/key ผิด?):')}
                    </span>
                  </TerminalLine>
                  <pre style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    fontSize: '0.8rem',
                    color: isReadable ? 'var(--text-cyan)' : 'var(--text-dim)',
                    background: 'rgba(0,0,0,0.3)',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    marginTop: '0.5rem',
                    maxHeight: '150px',
                    overflow: 'auto'
                  }}>
                    {decryptedMessage}
                  </pre>

                  {!isReadable && (
                    <div className="mt-2">
                      <TerminalLine type="output">
                        <span className="text-yellow">
                          {language === 'en'
                            ? 'The message is not readable. Go back to Step 3 and try a different salt!'
                            : 'ข้อความอ่านไม่ได้ กลับไป Step 3 แล้วลอง salt ใหม่!'}
                        </span>
                      </TerminalLine>
                      <TerminalLine type="output">
                        <span className="text-dim" style={{ fontSize: '0.75rem' }}>
                          {language === 'en'
                            ? 'Hint: The correct decrypted message should be human-readable text.'
                            : 'Hint: ข้อความที่ถอดรหัสถูกต้องจะเป็นข้อความที่มนุษย์อ่านได้'}
                        </span>
                      </TerminalLine>
                      <button
                        className="btn btn-small mt-1"
                        onClick={() => {
                          setDecryptedMessage('');
                          setAesKey('');
                        }}
                      >
                        {language === 'en' ? 'Try Different Key' : 'ลอง Key อื่น'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Step 5: RSA Signature */}
        {step >= 5 && (
          <div className="code-block mt-2">
            <TerminalLine type="output">
              <span className="text-yellow">Step 5: Get RSA Signature</span>
            </TerminalLine>

            {!signature && (
              <button
                className="btn btn-small mt-1"
                onClick={fetchSignature}
                disabled={loading}
              >
                {loading ? 'FETCHING...' : (language === 'en' ? 'Fetch Signature' : 'ดึง Signature')}
              </button>
            )}

            {/* Signature fetched */}
            {signature && (
              <div className="mt-1">
                <TerminalLine type="output">
                  <span className="text-green">RSA Signature (Base64):</span>
                </TerminalLine>
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  fontSize: '0.65rem',
                  color: 'var(--text-cyan)',
                  background: 'rgba(0,0,0,0.3)',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  marginTop: '0.25rem',
                  userSelect: 'all',
                  cursor: 'pointer',
                  maxHeight: '80px',
                  overflow: 'auto'
                }} title="Click to select">
                  {signature}
                </pre>
                <TerminalLine type="output">
                  <span className="text-dim" style={{ fontSize: '0.75rem' }}>
                    {language === 'en'
                      ? '↑ You will need this signature to generate the FLAG in Step 6'
                      : '↑ คุณต้องใช้ signature นี้ในการสร้าง FLAG ใน Step 6'}
                  </span>
                </TerminalLine>
              </div>
            )}
          </div>
        )}

        {/* Step 6: Generate Flag - Only show after signature is fetched */}
        {step >= 5 && signature && (
          <div className="code-block mt-2">
            <TerminalLine type="output">
              <span className="text-yellow">Step 6: Generate FLAG_1</span>
            </TerminalLine>
            <TerminalLine type="output">
              <span className="text-dim">
                {language === 'en'
                  ? 'Calculate the FLAG using:'
                  : 'คำนวณ FLAG โดยใช้:'}
              </span>
            </TerminalLine>
            <TerminalLine type="output">
              <span className="text-cyan">FLAG = MUT{'{'}SHA256(decrypted_message + "????????" + signature)[:32]{'}'}</span>
            </TerminalLine>
            <TerminalLine type="output">
              <span className="text-dim" style={{ fontSize: '0.75rem' }}>
                {language === 'en'
                  ? 'Hint: Take first 32 hex characters of SHA256 hash'
                  : 'Hint: ใช้ 32 ตัวอักษร hex แรกของ SHA256 hash'}
              </span>
            </TerminalLine>
            <TerminalLine type="output">
              <span className="text-yellow" style={{ fontSize: '0.85rem' }}>
                🎂 Hint: "Happy Birthday SUT"
              </span>
            </TerminalLine>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <TerminalLine type="error" className="mt-2">
            [ERROR] {error}
          </TerminalLine>
        )}
      </div>
    </div>
  );
}

export default CryptoCalculator;
