// MUT Secure Vault - Email Service
import nodemailer from 'nodemailer';

// Create transporter - uses environment variables or defaults to Ethereal (test)
let transporter = null;

async function initTransporter() {
  if (transporter) return transporter;

  // Check if real SMTP is configured
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } else {
    // Use Ethereal for testing (fake SMTP)
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    console.log('[Email] Using Ethereal test account:', testAccount.user);
  }

  return transporter;
}

// Scramble a word (shuffle letters)
function scrambleWord(word) {
  const letters = word.split('');
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  return letters.join('');
}

// Generate scrambled password hint
function generatePasswordHint(password) {
  // password = "computer_engineering_#28!"
  // Scramble the words before _ and #
  const parts = password.split('_');
  const scrambled = parts.map((part, index) => {
    if (index === parts.length - 1) {
      // Last part has #28!, keep the suffix
      const match = part.match(/^([a-z]+)(#.+)$/);
      if (match) {
        return scrambleWord(match[1]) + match[2];
      }
    }
    return scrambleWord(part);
  });
  return scrambled.join('_');
}

// Generate envelope hint for PIN
function generateEnvelopeHint() {
  return `
┌─────────────────────────────────────────┐
│                                         │
│  ถึง: มหาวิทยาลัยเทคโนโลยีสุรนารี              │
│       111 ถ.มหาวิทยาลัย ต.สุรนารี          │
│       อ.เมือง จ.นครราชสีมา ?????         │
│                                         │
└─────────────────────────────────────────┘

To: Suranaree University of Technology
    111 University Ave, Suranaree
    Muang, Nakhon Ratchasima ?????
`;
}

// Send OTP email
async function sendOTPEmail(email, otp) {
  try {
    const transport = await initTransporter();

    const passwordHint = generatePasswordHint('computer_engineering_#28!');
    const envelopeHint = generateEnvelopeHint();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Courier New', monospace; background: #0a0a0a; color: #00ff00; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; border: 1px solid #00ff00; padding: 20px; }
    .header { text-align: center; border-bottom: 1px solid #00ff00; padding-bottom: 15px; }
    .otp-box { background: #001100; padding: 20px; margin: 20px 0; text-align: center; }
    .otp-code { font-size: 32px; letter-spacing: 8px; color: #00ff00; }
    .hint-box { background: #111; padding: 15px; margin: 15px 0; border-left: 3px solid #ffff00; }
    .envelope { font-family: monospace; white-space: pre; background: #fff; color: #000; padding: 10px; margin: 10px 0; }
    .warning { color: #ff6600; }
    .cyan { color: #00ffff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MUT SECURE VAULT</h1>
      <p>Challenge 2: Authentication</p>
    </div>

    <div class="otp-box">
      <p>Your One-Time Password (OTP):</p>
      <div class="otp-code">${otp}</div>
      <p style="color: #888; font-size: 12px;">Valid for 5 minutes</p>
    </div>

    <div class="hint-box">
      <p class="cyan">FACTOR 2 HINT - Password:</p>
      <p>Unscramble this: <strong>${passwordHint}</strong></p>
      <p style="color: #888; font-size: 12px;">Hint: It's about a field of study with a number</p>
    </div>

    <div class="hint-box">
      <p class="cyan">FACTOR 3 HINT - PIN:</p>
      <p>What's the postal code on this envelope?</p>
      <pre class="envelope">${envelopeHint}</pre>
    </div>

    <p class="warning">This email was sent for MUT Secure Vault CTF challenge.</p>
  </div>
</body>
</html>
`;

    const textContent = `
MUT SECURE VAULT - Challenge 2: Authentication
================================================

Your One-Time Password (OTP): ${otp}
(Valid for 5 minutes)

------------------------------------------------
FACTOR 2 HINT - Password:
Unscramble this: ${passwordHint}
(Hint: It's about a field of study with a number)

------------------------------------------------
FACTOR 3 HINT - PIN:
What's the postal code on this envelope?

${envelopeHint}

================================================
This email was sent for MUT Secure Vault CTF challenge.
`;

    const info = await transport.sendMail({
      from: '"MUT Secure Vault" <noreply@mut-vault.local>',
      to: email,
      subject: `[MUT Vault] Your OTP Code: ${otp}`,
      text: textContent,
      html: htmlContent
    });

    console.log('[Email] Message sent:', info.messageId);

    // If using Ethereal, get preview URL
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('[Email] Preview URL:', previewUrl);
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl || null
    };

  } catch (error) {
    console.error('[Email] Send error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  sendOTPEmail,
  generatePasswordHint,
  generateEnvelopeHint
};
