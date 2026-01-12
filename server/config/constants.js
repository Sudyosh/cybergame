// MUT Secure Vault - Constants & SUT Integration Data
// Suranaree University of Technology (SUT) reference data

export const SUT_DATA = {
  name: {
    en: 'Suranaree University of Technology',
    th: 'มหาวิทยาลัยเทคโนโลยีสุรนารี'
  },
  yearEstablished: 1990,
  postalCode: '30000'
};

// Cryptographic constants
export const CRYPTO_CONFIG = {
  aes: {
    algorithm: 'aes-256-cbc',
    keyLength: 32,
    ivLength: 16
  },
  rsa: {
    modulusLength: 2048,
    publicExponent: 65537
  },
  dh: {
    primeLength: 2048
  },
  hash: {
    algorithm: 'sha256'
  },
  salt: 'suranaree'
};

// Authentication constants
export const AUTH_CONFIG = {
  password: {
    saltRounds: 10,
    minLength: 8
  },
  pin: {
    length: 5,
    maxAttempts: 3,
    lockoutMinutes: 15
  },
  jwt: {
    expiresIn: '2h',
    algorithm: 'HS256'
  },
  otp: {
    digits: 6,
    window: 1, // Allow 30 seconds tolerance
    step: 30
  }
};

// Security levels for MLS
export const SECURITY_LEVELS = {
  PUBLIC: 1,
  CONFIDENTIAL: 2,
  SECRET: 3,
  TOP_SECRET: 4
};

export const SECURITY_LEVEL_NAMES = {
  1: { en: 'Public', th: 'สาธารณะ' },
  2: { en: 'Confidential', th: 'ลับ' },
  3: { en: 'Secret', th: 'ลับมาก' },
  4: { en: 'Top Secret', th: 'ลับที่สุด' }
};

// Role definitions for RBAC
export const ROLES = {
  STUDENT: { id: 1, name: 'Student', level: SECURITY_LEVELS.PUBLIC },
  RESEARCHER: { id: 2, name: 'Researcher', level: SECURITY_LEVELS.CONFIDENTIAL },
  ADMIN: { id: 3, name: 'Admin', level: SECURITY_LEVELS.SECRET },
  DIRECTOR: { id: 4, name: 'Director', level: SECURITY_LEVELS.TOP_SECRET }
};

// Challenge gating
export const CHALLENGES = {
  1: { name: 'Cryptography', requiredPrevious: null },
  2: { name: 'Authentication', requiredPrevious: 1 },
  3: { name: 'Authorization', requiredPrevious: 2 }
};

// Flag format
export const FLAG_FORMAT = {
  prefix: 'MUT',
  hashLength: 32
};

// Story text
export const STORY = {
  intro: {
    en: `Welcome to MUT Secure Vault - the classified research protection system of Suranaree University of Technology.

In 1990, the founders encrypted critical research data using the most advanced cryptographic techniques of their time.
Your mission is to prove your worth by solving three challenges that test your knowledge of cybersecurity fundamentals.

Each challenge unlocks the next. Complete all three to access the legendary Top Secret research files.`,
    th: `ยินดีต้อนรับสู่ MUT Secure Vault - ระบบป้องกันข้อมูลวิจัยลับของมหาวิทยาลัยเทคโนโลยีสุรนารี

ในปี พ.ศ. 2533 ผู้ก่อตั้งได้เข้ารหัสข้อมูลวิจัยสำคัญด้วยเทคนิคการเข้ารหัสที่ก้าวหน้าที่สุดในยุคนั้น
ภารกิจของคุณคือพิสูจน์ความสามารถโดยการแก้ปริศนาสามด่านที่ทดสอบความรู้ด้านความปลอดภัยไซเบอร์

แต่ละด่านจะปลดล็อคด่านถัดไป ทำให้สำเร็จทั้งสามด่านเพื่อเข้าถึงไฟล์วิจัยลับที่สุด`
  },
  challenge1: {
    title: {
      en: 'Chapter 1: The Encrypted Legacy',
      th: 'บทที่ 1: มรดกที่ถูกเข้ารหัส'
    },
    description: {
      en: `The ancient vault of MUT contains secrets encrypted by our founders in 1990.
To prove your worth, you must decrypt the legacy message using the sacred cryptographic arts.

You will need to master:
- Diffie-Hellman Key Exchange
- AES-256 Symmetric Encryption
- RSA-2048 Digital Signatures
- SHA-256 Hashing

Download the cryptographic artifacts and begin your journey...`,
      th: `ห้องนิรภัยโบราณของ MUT เก็บความลับที่ถูกเข้ารหัสโดยผู้ก่อตั้งในปี 2533
เพื่อพิสูจน์ตัวเอง คุณต้องถอดรหัสข้อความมรดกโดยใช้ศาสตร์การเข้ารหัส

คุณจะต้องเชี่ยวชาญ:
- การแลกเปลี่ยนคีย์ Diffie-Hellman
- การเข้ารหัสแบบสมมาตร AES-256
- ลายเซ็นดิจิทัล RSA-2048
- การแฮช SHA-256

ดาวน์โหลดสิ่งประดิษฐ์การเข้ารหัสและเริ่มการเดินทางของคุณ...`
    }
  },
  challenge2: {
    title: {
      en: "Chapter 2: The Guardian's Gauntlet",
      th: 'บทที่ 2: ด่านของผู้พิทักษ์'
    },
    description: {
      en: `You have decrypted the ancient message, but the inner sanctum requires proof of identity.
The Guardian demands three proofs:
- Something you KNOW (password)
- Something UNIQUE (PIN)
- Something TEMPORAL (one-time code)

Only those who pass all three trials may proceed...`,
      th: `คุณถอดรหัสข้อความโบราณได้แล้ว แต่ห้องชั้นในต้องการการพิสูจน์ตัวตน
ผู้พิทักษ์ต้องการหลักฐานสามอย่าง:
- สิ่งที่คุณ รู้ (รหัสผ่าน)
- สิ่งที่ ไม่ซ้ำใคร (PIN)
- สิ่งที่ ชั่วคราว (รหัสครั้งเดียว)

เฉพาะผู้ที่ผ่านการทดสอบทั้งสามเท่านั้นที่จะเดินหน้าต่อได้...`
    }
  },
  challenge3: {
    title: {
      en: 'Chapter 3: The Hierarchy of Secrets',
      th: 'บทที่ 3: ลำดับชั้นแห่งความลับ'
    },
    description: {
      en: `You have proven your identity. Now you must navigate the labyrinth of permissions.
As a lowly Student, you can see little. But the Top Secret file awaits those who understand the true nature of access control.

The hierarchy stands:
- Student (Public)
- Researcher (Confidential)
- Admin (Secret)
- Director (Top Secret)

Find the flaws in the system. Ascend the hierarchy. Claim the FINAL FLAG.`,
      th: `คุณพิสูจน์ตัวตนได้แล้ว ตอนนี้คุณต้องนำทางผ่านเขาวงกตของสิทธิ์
ในฐานะนักศึกษาระดับล่าง คุณเห็นได้น้อย แต่ไฟล์ลับที่สุดรอคอยผู้ที่เข้าใจธรรมชาติแท้จริงของการควบคุมการเข้าถึง

ลำดับชั้นคือ:
- นักศึกษา (สาธารณะ)
- นักวิจัย (ลับ)
- ผู้ดูแลระบบ (ลับมาก)
- ผู้อำนวยการ (ลับที่สุด)

ค้นหาจุดอ่อนในระบบ ไต่เต้าลำดับชั้น คว้า FLAG สุดท้าย`
    }
  }
};

export default {
  SUT_DATA,
  CRYPTO_CONFIG,
  AUTH_CONFIG,
  SECURITY_LEVELS,
  SECURITY_LEVEL_NAMES,
  ROLES,
  CHALLENGES,
  FLAG_FORMAT,
  STORY
};
