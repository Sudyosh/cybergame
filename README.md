# MUT Secure Vault - เกม CTF สำหรับการศึกษาความปลอดภัยไซเบอร์

เว็บแอปพลิเคชัน Capture The Flag (CTF) แบบเรื่องราว สำหรับการศึกษาความปลอดภัยไซเบอร์ ประกอบด้วย 3 ด่านท้าทายเกี่ยวกับการเข้ารหัส การยืนยันตัวตน และการควบคุมสิทธิ์การเข้าถึง

## ภาพรวม

MUT Secure Vault ออกแบบมาสำหรับรายวิชาความปลอดภัยไซเบอร์ของมหาวิทยาลัยเทคโนโลยีสุรนารี (มทส.) ผู้เล่นจะต้องผ่านด่านตามลำดับเพื่อเข้าถึงไฟล์วิจัยลับที่สุด

### เทคโนโลยีที่ใช้

- **Backend**: Node.js + Express.js
- **Frontend**: React + Vite
- **Database**: SQLite
- **ธีม**: Terminal/Hacker (ธีมมืด ตัวอักษรสีเขียว)
- **ภาษา**: รองรับ 2 ภาษา (ไทย/อังกฤษ)

## เริ่มต้นใช้งาน

### สิ่งที่ต้องมี

- Node.js เวอร์ชัน 18 ขึ้นไป
- npm หรือ yarn

### การติดตั้ง

```bash
# Clone โปรเจกต์
git clone https://github.com/your-repo/cybergame.git
cd cybergame

# ติดตั้ง dependencies สำหรับ backend
cd server
npm install
cp .env.example .env

# ติดตั้ง dependencies สำหรับ frontend
cd ../client
npm install

# กลับไปที่ root
cd ..
```

### รันแอปพลิเคชัน

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```
Server รันที่ http://localhost:3001

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```
Frontend รันที่ http://localhost:5173

### เข้าเล่นเกม

1. เปิด http://localhost:5173
2. ลงทะเบียนบัญชีใหม่
3. เริ่มเซสชันเกม
4. ผ่านด่านทั้งสามด่าน!

## รายละเอียดด่าน

### ด่านที่ 1: การเข้ารหัส (Cryptography)
**บทที่ 1: มรดกที่ถูกเข้ารหัส**

ทดสอบความรู้เกี่ยวกับการเข้ารหัสข้อมูล:
- **Diffie-Hellman Key Exchange** - การแลกเปลี่ยนคีย์แบบปลอดภัย
- **AES-256 Symmetric Encryption** - การเข้ารหัสแบบสมมาตร
- **RSA-2048 Digital Signatures** - ลายเซ็นดิจิทัล
- **SHA-256 Hashing** - การแฮชข้อมูล

### ด่านที่ 2: การยืนยันตัวตน (Authentication)
**บทที่ 2: ด่านของผู้พิทักษ์**

ทดสอบ Multi-Factor Authentication (MFA) 3 ปัจจัย:
- **รหัสผ่าน (Password)** - สิ่งที่คุณรู้
- **PIN** - สิ่งที่ไม่ซ้ำใคร
- **OTP (One-Time Password)** - รหัสที่ใช้ครั้งเดียว

### ด่านที่ 3: การควบคุมสิทธิ์ (Authorization)
**บทที่ 3: ลำดับชั้นแห่งความลับ**

ทดสอบความเข้าใจเกี่ยวกับการควบคุมการเข้าถึง:
- **Access Control Matrix (ACM)** - ตารางควบคุมการเข้าถึง
- **Role-Based Access Control (RBAC)** - ควบคุมตามบทบาท
- **Attribute-Based Access Control (ABAC)** - ควบคุมตามคุณลักษณะ
- **Rule-Based Access Control** - ควบคุมตามกฎ
- **Multi-Level Security (Bell-LaPadula)** - ความปลอดภัยหลายระดับ

ลำดับชั้นสิทธิ์:
- นักศึกษา (Student) → สาธารณะ (Public)
- นักวิจัย (Researcher) → ลับ (Confidential)
- ผู้ดูแลระบบ (Admin) → ลับมาก (Secret)
- ผู้อำนวยการ (Director) → ลับที่สุด (Top Secret)

## เอกสารประกอบ

- [คู่มือผู้เล่น](docs/PLAYER_GUIDE.md) - วิธีการเล่นเกม
- [คู่มือผู้สอน](docs/INSTRUCTOR_WALKTHROUGH.md) - เฉลยครบถ้วน (สำหรับผู้สอนเท่านั้น)
- [เอกสาร API](docs/API_DOCUMENTATION.md) - รายละเอียด API endpoints

## การเข้าถึงระบบ Admin

ใช้ header `X-Admin-Key: MUT_ADMIN_1990` สำหรับ admin endpoints:

```bash
curl -H "X-Admin-Key: MUT_ADMIN_1990" http://localhost:3001/api/admin/stats
```

## โครงสร้างโปรเจกต์

```
cybergame/
├── server/                 # Backend (Node.js/Express)
│   ├── config/            # ไฟล์ตั้งค่า
│   ├── middleware/        # Auth, RBAC, ABAC, MLS
│   ├── routes/            # API routes
│   ├── services/          # Crypto, OTP, Flag services
│   └── index.js           # Entry point
├── client/                # Frontend (React/Vite)
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/         # Page components
│   │   ├── context/       # React contexts
│   │   └── styles/        # Terminal theme CSS
│   └── index.html
├── database/              # SQLite schema และ seed
└── docs/                  # เอกสารประกอบ
```

## วัตถุประสงค์การเรียนรู้

หลังจากเล่นเกมนี้ ผู้เล่นจะได้เรียนรู้:

1. **ด่านที่ 1** - เข้าใจหลักการทำงานของอัลกอริทึมการเข้ารหัสที่สำคัญ
2. **ด่านที่ 2** - เข้าใจความสำคัญของ Multi-Factor Authentication
3. **ด่านที่ 3** - เข้าใจช่องโหว่ที่พบบ่อยในระบบควบคุมสิทธิ์

## ลิขสิทธิ์

สำหรับใช้ในการศึกษาเท่านั้น สำหรับรายวิชาความปลอดภัยไซเบอร์ของมหาวิทยาลัยเทคโนโลยีสุรนารี

## เครดิต

- มหาวิทยาลัยเทคโนโลยีสุรนารี (มทส.)
- ก่อตั้งปี พ.ศ. 2533 จังหวัดนครราชสีมา ประเทศไทย

