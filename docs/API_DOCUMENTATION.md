# MUT Secure Vault - เอกสาร API

Base URL: `http://localhost:3001`

---

## การยืนยันตัวตน

### ลงทะเบียน
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "agent_name",
  "email": "agent@example.com",
  "password": "minimum8chars"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful",
  "playerId": 1,
  "username": "agent_name"
}
```

### เข้าสู่ระบบ
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "agent_name",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt_token_here",
  "player": {
    "id": 1,
    "username": "agent_name",
    "email": "agent@example.com"
  }
}
```

### เริ่มเกม Session
```http
POST /api/game/start
Authorization: Bearer <login_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Game session started",
  "sessionId": 1,
  "token": "session_jwt_token"
}
```

### ดูความคืบหน้า
```http
GET /api/auth/session/progress
Authorization: Bearer <session_token>
```

**Response:**
```json
{
  "sessionId": 1,
  "progress": {
    "challenge1": false,
    "challenge2": false,
    "challenge3": false
  },
  "role": "Student",
  "securityLevel": 1
}
```

---

## ด่าน 1: Cryptography

### รับเรื่องราว
```http
GET /api/c1/story
Authorization: Bearer <session_token>
```

### ดาวน์โหลด Artifacts
```http
GET /api/c1/artifacts
Authorization: Bearer <session_token>
```

**Response:**
```json
{
  "success": true,
  "artifacts": {
    "diffieHellman": {
      "prime": "hex_string",
      "generator": "hex_string",
      "hint": { "en": "...", "th": "..." }
    },
    "rsa": {
      "publicKey": "-----BEGIN PUBLIC KEY-----..."
    },
    "aes": {
      "iv": "hex_string"
    },
    "saltCipher": {
      "cipherText": "jlirerivv",
      "hint": "Caesar cipher - find the right shift to decode"
    },
    "metadata": {
      "sutFoundingDate": "27 July 1990",
      "buddhistEra": "27 กรกฎาคม 2533"
    }
  }
}
```

### DH Key Exchange
```http
POST /api/c1/dh/exchange
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "clientPublicKey": "hex_string_of_your_public_key"
}
```

**Response:**
```json
{
  "success": true,
  "serverPublicKey": "hex_string"
}
```

### รับข้อมูลที่เข้ารหัส
```http
GET /api/c1/encrypted
Authorization: Bearer <session_token>
```

**Response:**
```json
{
  "success": true,
  "encrypted": {
    "algorithm": "AES-256-CBC",
    "iv": "hex_string",
    "data": "hex_encrypted_data"
  }
}
```

### รับลายเซ็น
```http
GET /api/c1/signature
Authorization: Bearer <session_token>
```

**Response:**
```json
{
  "success": true,
  "signature": {
    "algorithm": "RSA-SHA256",
    "data": "hex_signature"
  },
  "flagFormula": "FLAG_1 = MUT{SHA256(decrypted_message + \"????????\" + signature)[:32]}"
}
```

### ส่ง FLAG_1
```http
POST /api/c1/submit-flag
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "flag": "MUT{32_char_hex_hash}"
}
```

---

## ด่าน 2: Authentication

### รับสถานะ
```http
GET /api/c2/status
Authorization: Bearer <session_token>
```

**Response:**
```json
{
  "factors": {
    "email": { "verified": false },
    "password": { "verified": false, "hint": {...} },
    "pin": { "verified": false, "attempts": 0, "maxAttempts": 3 }
  },
  "mfaComplete": false
}
```

### ส่ง Email OTP
```http
POST /api/c2/email/send-otp
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "email": "your@email.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent to email",
  "demoOTP": "123456"
}
```

### ยืนยัน Email OTP
```http
POST /api/c2/email/verify-otp
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "otp": "123456"
}
```

### ยืนยันรหัสผ่าน
```http
POST /api/c2/password
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "password": "your_unscrambled_password"
}
```

### ยืนยัน PIN
```http
POST /api/c2/pin
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "pin": "30000"
}
```

### รับสถานะ MFA / FLAG_2
```http
GET /api/c2/mfa/status
Authorization: Bearer <session_token>
```

**Response (when complete):**
```json
{
  "success": true,
  "mfaComplete": true,
  "flag2": "MUT{...}"
}
```

### ส่ง FLAG_2
```http
POST /api/c2/submit-flag
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "flag": "MUT{...}"
}
```

---

## ด่าน 3: Authorization

### รับบทบาท/Attributes ปัจจุบัน
```http
GET /api/c3/whoami
Authorization: Bearer <session_token>
```

**Response:**
```json
{
  "sessionId": 1,
  "role": {
    "id": 1,
    "name": "Student",
    "securityLevel": 1
  },
  "attributes": {
    "department": "general",
    "clearance_training": "none"
  }
}
```

### รายการบทบาททั้งหมด
```http
GET /api/c3/roles
Authorization: Bearer <session_token>
```

### รายการทรัพยากร
```http
GET /api/c3/resources
Authorization: Bearer <session_token>
```

### เข้าถึงทรัพยากร
```http
GET /api/c3/resources/:id
Authorization: Bearer <session_token>
X-System-Time: 02:30  # ทางเลือก: maintenance bypass
```

### ดู Access Control Matrix
```http
GET /api/c3/acm
Authorization: Bearer <session_token>
```

### ดูกฎการเข้าถึง
```http
GET /api/c3/rules
Authorization: Bearer <session_token>
```

### ดู Attributes
```http
GET /api/c3/attributes
Authorization: Bearer <session_token>
```

### อัปเดต Attributes (มีช่องโหว่)
```http
POST /api/c3/attributes
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "attribute": "clearance_training",
  "value": "complete"
}
```

### ขอสิทธิ์เข้าถึง (มีช่องโหว่)
```http
POST /api/c3/request-access
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "resource": "project_alpha.txt",
  "reason": "Research collaboration"
}
```

### Declassify (มีช่องโหว่)
```http
POST /api/c3/declassify
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "resource": "FINAL_FLAG.txt",
  "requester_role": "Director",
  "reason": "Audit review"
}
```

### รับ Final Flag
```http
GET /api/c3/final-flag
Authorization: Bearer <session_token>
```

### ส่ง Final Flag
```http
POST /api/c3/submit-flag
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "flag": "MUT{...}"
}
```

---

## Admin Endpoints

Admin endpoints ทุกตัวต้องใช้ header: `X-Admin-Key: MUT_ADMIN_1990`

### รายการ Sessions
```http
GET /api/admin/sessions
X-Admin-Key: MUT_ADMIN_1990
```

### รายละเอียด Session
```http
GET /api/admin/session/:id
X-Admin-Key: MUT_ADMIN_1990
```

### ดู Audit Logs
```http
GET /api/admin/audit?sessionId=1&action=LOGIN&limit=100
X-Admin-Key: MUT_ADMIN_1990
```

### รีเซ็ต Session
```http
POST /api/admin/reset/:sessionId
X-Admin-Key: MUT_ADMIN_1990
```

### รับสถิติ
```http
GET /api/admin/stats
X-Admin-Key: MUT_ADMIN_1990
```

### รับเฉลย
```http
GET /api/admin/walkthrough
X-Admin-Key: MUT_ADMIN_1990
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "คำอธิบายสิ่งที่ผิดพลาด"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "ไม่มี authentication token"
}
```

### 403 Forbidden
```json
{
  "error": "Access Denied",
  "message": "ระดับความปลอดภัยไม่เพียงพอ"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "ไม่พบทรัพยากร"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate Limited",
  "message": "คำขอมากเกินไป กรุณารอ",
  "retryAfter": "60 seconds"
}
```

---

## Rate Limits

| Endpoint | ขีดจำกัด |
|----------|----------|
| Authentication | 10/นาที |
| Flag Submission | 5/นาที |
| PIN Verification | 3/5 นาที |
| OTP Verification | 5/นาที |
| API ทั่วไป | 100/นาที |
