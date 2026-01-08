import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Terminal, TerminalLine } from '../components/common/Terminal';
import { ChallengeProgress } from '../components/common/ChallengeProgress';
import api from '../services/api';

export function Dashboard() {
  const { t, language } = useLanguage();
  const { user, refreshProgress, isAuthenticated, updateToken } = useAuth();
  const navigate = useNavigate();
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    refreshProgress();
  }, []);

  const progress = user?.progress || {};
  const currentChallenge = !progress.challenge1 ? 1 : !progress.challenge2 ? 2 : !progress.challenge3 ? 3 : 0;

  const handleStartChallenge = (num) => {
    navigate(`/challenge/${num}`);
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

  return (
    <div className="main-content">
      <ChallengeProgress />

      <div className="grid grid-2">
        <Terminal title="mission_status.log">
          <TerminalLine type="command" prompt="$">
            cat /var/log/mission_status.log
          </TerminalLine>

          <div className="mt-2">
            <TerminalLine type="output">
              <span className="text-cyan">AGENT STATUS REPORT</span>
            </TerminalLine>
            <TerminalLine type="output">
              <span className="text-dim">========================</span>
            </TerminalLine>

            <TerminalLine type="output">
              Agent: <span className="text-yellow">@{user?.username || 'unknown'}</span>
            </TerminalLine>
            <TerminalLine type="output">
              Session: <span className="text-yellow">#{user?.sessionId || 'N/A'}</span>
            </TerminalLine>
            <TerminalLine type="output">
              Role: <span className="text-yellow">{user?.role || 'Student'}</span>
            </TerminalLine>
            <TerminalLine type="output">
              Security Level: <span className="text-yellow">{user?.securityLevel || 1}</span>
            </TerminalLine>

            <div className="mt-2">
              <TerminalLine type="output">
                <span className="text-dim">------------------------</span>
              </TerminalLine>
              <TerminalLine type="output">
                Challenge 1: {progress.challenge1 ?
                  <span className="text-green">[COMPLETE]</span> :
                  <span className="text-yellow">[PENDING]</span>
                }
              </TerminalLine>
              <TerminalLine type="output">
                Challenge 2: {progress.challenge2 ?
                  <span className="text-green">[COMPLETE]</span> :
                  progress.challenge1 ?
                    <span className="text-yellow">[UNLOCKED]</span> :
                    <span className="text-red">[LOCKED]</span>
                }
              </TerminalLine>
              <TerminalLine type="output">
                Challenge 3: {progress.challenge3 ?
                  <span className="text-green">[COMPLETE]</span> :
                  progress.challenge2 ?
                    <span className="text-yellow">[UNLOCKED]</span> :
                    <span className="text-red">[LOCKED]</span>
                }
              </TerminalLine>
            </div>

            {progress.challenge1 && progress.challenge2 && progress.challenge3 && (
              <div className="mt-2">
                <TerminalLine type="output">
                  <span className="text-green glow">
                    *** ALL CHALLENGES COMPLETE ***
                  </span>
                </TerminalLine>
              </div>
            )}
          </div>
        </Terminal>

        <Terminal title="next_objective.txt">
          <TerminalLine type="command" prompt="$">
            cat /mission/next_objective.txt
          </TerminalLine>

          <div className="mt-2">
            {currentChallenge === 0 ? (
              <>
                <TerminalLine type="output">
                  <span className="text-green glow">MISSION COMPLETE!</span>
                </TerminalLine>
                <TerminalLine type="output">
                  {language === 'en' ?
                    'Congratulations! You have completed all challenges.' :
                    'ยินดีด้วย! คุณผ่านทุกด่านแล้ว'}
                </TerminalLine>
                <div className="mt-3">
                  <button className="btn btn-warning" onClick={handleReset} disabled={resetting}>
                    {resetting
                      ? (language === 'en' ? 'RESETTING...' : 'กำลังรีเซ็ต...')
                      : (language === 'en' ? 'RESET & PLAY AGAIN' : 'รีเซ็ตและเล่นใหม่')}
                  </button>
                </div>
              </>
            ) : currentChallenge === 1 ? (
              <>
                <TerminalLine type="output">
                  <span className="text-cyan">CHAPTER 1: THE ENCRYPTED LEGACY</span>
                </TerminalLine>
                <TerminalLine type="output">
                  {language === 'en' ?
                    'Master the cryptographic arts: DH, AES, RSA, SHA-256' :
                    'เชี่ยวชาญศาสตร์การเข้ารหัส: DH, AES, RSA, SHA-256'}
                </TerminalLine>
                <div className="mt-2">
                  <button className="btn" onClick={() => handleStartChallenge(1)}>
                    START CHALLENGE 1
                  </button>
                </div>
              </>
            ) : currentChallenge === 2 ? (
              <>
                <TerminalLine type="output">
                  <span className="text-cyan">CHAPTER 2: THE GUARDIAN'S GAUNTLET</span>
                </TerminalLine>
                <TerminalLine type="output">
                  {language === 'en' ?
                    'Prove your identity: Password, PIN, OTP, Location' :
                    'พิสูจน์ตัวตน: รหัสผ่าน, PIN, OTP, ตำแหน่ง'}
                </TerminalLine>
                <div className="mt-2">
                  <button className="btn" onClick={() => handleStartChallenge(2)}>
                    START CHALLENGE 2
                  </button>
                </div>
              </>
            ) : (
              <>
                <TerminalLine type="output">
                  <span className="text-cyan">CHAPTER 3: THE HIERARCHY OF SECRETS</span>
                </TerminalLine>
                <TerminalLine type="output">
                  {language === 'en' ?
                    'Navigate access control: RBAC, ABAC, MLS vulnerabilities' :
                    'นำทางการควบคุมการเข้าถึง: ช่องโหว่ RBAC, ABAC, MLS'}
                </TerminalLine>
                <div className="mt-2">
                  <button className="btn" onClick={() => handleStartChallenge(3)}>
                    START CHALLENGE 3
                  </button>
                </div>
              </>
            )}
          </div>
        </Terminal>
      </div>

      <Terminal title="hints.md">
        <TerminalLine type="command" prompt="$">
          cat /mission/hints.md
        </TerminalLine>

        <div className="mt-2">
          <TerminalLine type="output">
            <span className="text-yellow"># IMPORTANT HINTS</span>
          </TerminalLine>

          <TerminalLine type="output">
            {language === 'en' ? (
              <>
                - Suranaree University of Technology was established in <span className="text-cyan">1990</span>
                <br />
                - Campus location: <span className="text-cyan">Nakhon Ratchasima</span>, Thailand
                <br />
                - Postal code: <span className="text-cyan">30000</span>
                <br />
                - Coordinates: <span className="text-cyan">14.8820°N, 102.0204°E</span>
                <br /><br />
                These numbers are significant for the challenges...
              </>
            ) : (
              <>
                - มหาวิทยาลัยเทคโนโลยีสุรนารีก่อตั้งในปี <span className="text-cyan">พ.ศ. 2533 (1990)</span>
                <br />
                - ที่ตั้ง: <span className="text-cyan">นครราชสีมา</span> ประเทศไทย
                <br />
                - รหัสไปรษณีย์: <span className="text-cyan">30000</span>
                <br />
                - พิกัด: <span className="text-cyan">14.8820°N, 102.0204°E</span>
                <br /><br />
                ตัวเลขเหล่านี้มีความสำคัญสำหรับด่านต่างๆ...
              </>
            )}
          </TerminalLine>
        </div>
      </Terminal>
    </div>
  );
}

export default Dashboard;
