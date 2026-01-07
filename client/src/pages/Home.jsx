import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Terminal, TerminalLine } from '../components/common/Terminal';

const ASCII_LOGO = `
███╗   ███╗██╗   ██╗████████╗    ██╗   ██╗ █████╗ ██╗   ██╗██╗  ████████╗
████╗ ████║██║   ██║╚══██╔══╝    ██║   ██║██╔══██╗██║   ██║██║  ╚══██╔══╝
██╔████╔██║██║   ██║   ██║       ██║   ██║███████║██║   ██║██║     ██║
██║╚██╔╝██║██║   ██║   ██║       ╚██╗ ██╔╝██╔══██║██║   ██║██║     ██║
██║ ╚═╝ ██║╚██████╔╝   ██║        ╚████╔╝ ██║  ██║╚██████╔╝███████╗██║
╚═╝     ╚═╝ ╚═════╝    ╚═╝         ╚═══╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝
`;

export function Home() {
  const { t, language } = useLanguage();
  const { isAuthenticated, startSession, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);

  const handleStartGame = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (user?.sessionId) {
      navigate('/dashboard');
      return;
    }

    setLoading(true);
    try {
      await startSession();
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to start session:', error);
    }
    setLoading(false);
  };

  return (
    <div className="main-content">
      <Terminal title="mut_secure_vault.exe">
        <pre className="ascii-art text-green">{ASCII_LOGO}</pre>

        <TerminalLine type="output">
          <span className="text-cyan">{'>'}</span> {t('appSubtitle')}
        </TerminalLine>

        <div className="mt-3 mb-3">
          <TerminalLine type="output">
            {language === 'en' ? (
              <>
                Welcome to MUT Secure Vault - the classified research protection system
                of Suranaree University of Technology.
                <br /><br />
                In 1990, the founders encrypted critical research data using the most
                advanced cryptographic techniques of their time.
                <br /><br />
                Your mission is to prove your worth by solving three challenges that
                test your knowledge of cybersecurity fundamentals:
                <br /><br />
                <span className="text-yellow">Challenge 1:</span> Cryptography - AES, RSA, Diffie-Hellman, Digital Signatures
                <br />
                <span className="text-yellow">Challenge 2:</span> Authentication - Password, PIN, OTP, Location, MFA
                <br />
                <span className="text-yellow">Challenge 3:</span> Authorization - RBAC, ABAC, MLS, Access Control
                <br /><br />
                Each challenge unlocks the next. Complete all three to access the
                legendary Top Secret research files.
              </>
            ) : (
              <>
                ยินดีต้อนรับสู่ MUT Secure Vault - ระบบป้องกันข้อมูลวิจัยลับ
                ของมหาวิทยาลัยเทคโนโลยีสุรนารี
                <br /><br />
                ในปี พ.ศ. 2533 ผู้ก่อตั้งได้เข้ารหัสข้อมูลวิจัยสำคัญด้วยเทคนิค
                การเข้ารหัสที่ก้าวหน้าที่สุดในยุคนั้น
                <br /><br />
                ภารกิจของคุณคือพิสูจน์ตัวเองโดยการแก้ปริศนาสามด่าน
                ที่ทดสอบความรู้ด้านความปลอดภัยไซเบอร์:
                <br /><br />
                <span className="text-yellow">ด่าน 1:</span> การเข้ารหัส - AES, RSA, Diffie-Hellman, ลายเซ็นดิจิทัล
                <br />
                <span className="text-yellow">ด่าน 2:</span> การยืนยันตัวตน - รหัสผ่าน, PIN, OTP, ตำแหน่ง, MFA
                <br />
                <span className="text-yellow">ด่าน 3:</span> การอนุญาต - RBAC, ABAC, MLS, การควบคุมการเข้าถึง
                <br /><br />
                แต่ละด่านจะปลดล็อคด่านถัดไป ทำให้สำเร็จทั้งสามด่าน
                เพื่อเข้าถึงไฟล์วิจัยลับที่สุด
              </>
            )}
          </TerminalLine>
        </div>

        <div className="flex flex-gap mt-3">
          <button
            className="btn"
            onClick={handleStartGame}
            disabled={loading}
          >
            {loading ? '...' : (isAuthenticated && user?.sessionId ? t('continueGame') : t('startGame'))}
          </button>

          {!isAuthenticated && (
            <button
              className="btn btn-cyan"
              onClick={() => navigate('/register')}
            >
              {t('register')}
            </button>
          )}
        </div>

        <div className="mt-3">
          <TerminalLine type="output">
            <span className="text-dim">
              {language === 'en'
                ? '// Suranaree University of Technology - Est. 1990'
                : '// มหาวิทยาลัยเทคโนโลยีสุรนารี - ก่อตั้ง พ.ศ. 2533'}
            </span>
          </TerminalLine>
        </div>
      </Terminal>
    </div>
  );
}

export default Home;
