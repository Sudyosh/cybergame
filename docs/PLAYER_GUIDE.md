# MUT Secure Vault - คู่มือผู้เล่น (ฉบับง่าย)

ยินดีต้อนรับ Agent! คู่มือนี้จะช่วยนำทางคุณผ่านด่าน CTF ของ MUT Secure Vault

## เริ่มต้นใช้งาน

### สำหรับ UI (Frontend)
1. ไปที่ http://localhost:5173
2. ลงทะเบียนและเข้าสู่ระบบ
3. คลิก "เริ่มเกม"

### สำหรับ API (Backend)
```bash
# 1. ลงทะเบียน
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"your_username","email":"your@email.com","password":"YourPassword123!"}'

# 2. เข้าสู่ระบบ (เก็บ token ไว้)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your_username","password":"YourPassword123!"}'

# 3. เริ่มเกม (ใช้ token จากขั้นตอนที่ 2)
curl -X POST http://localhost:3001/api/game/start \
  -H "Authorization: Bearer $TOKEN"
# จะได้ token ใหม่ที่มี sessionId - ใช้ token นี้ต่อไป
```

---

## ด่าน 1: Cryptography

### วิธีที่ 1: โหมดง่าย (แนะนำ)
ใช้ endpoint `/api/c1/easy-decrypt` ที่จะทำ DH exchange และถอดรหัสให้อัตโนมัติ

```bash
# ใช้ token จาก /api/game/start
curl http://localhost:3001/api/c1/easy-decrypt \
  -H "Authorization: Bearer $SESSION_TOKEN"
```

Response จะให้:
- `decryptedMessage`: ข้อความที่ถอดรหัสแล้ว
- `signature`: ลายเซ็นดิจิทัล
- `example`: โค้ด Python สำหรับคำนวณ flag

### สร้าง FLAG_1
```python
import hashlib

message = "ข้อความจาก decryptedMessage"
signature = "signature จาก response"

data = message + "1990" + signature
hash_result = hashlib.sha256(data.encode()).hexdigest()[:32]
FLAG_1 = f"MUT{{{hash_result}}}"
print(FLAG_1)
```

---

### วิธีที่ 2: โหมดยาก (ทำเองทั้งหมด)

#### ขั้นตอนที่ 1: ดาวน์โหลด Artifacts
```bash
curl http://localhost:3001/api/c1/artifacts -H "Authorization: Bearer $TOKEN"
```

#### ขั้นตอนที่ 2: Diffie-Hellman Key Exchange
```python
import random

# ค่าจาก artifacts
p = int(artifacts['diffieHellman']['prime'], 16)
g = int(artifacts['diffieHellman']['generator'], 16)

# สร้าง client private key
a = random.getrandbits(256)

# คำนวณ client public key: A = g^a mod p
A = pow(g, a, p)

# ส่งไป server
# POST /api/c1/dh/exchange กับ {"clientPublicKey": hex(A)[2:]}

# รับ server public key (B) แล้วคำนวณ shared secret
shared_secret = pow(B, a, p)
```

#### ขั้นตอนที่ 3: สร้าง AES Key
```python
import hashlib
key_data = hex(shared_secret)[2:] + "SUT1990"
aes_key = hashlib.sha256(key_data.encode()).digest()
```

#### ขั้นตอนที่ 4: ถอดรหัส AES-256-CBC
```python
from Crypto.Cipher import AES

# GET /api/c1/encrypted
iv = bytes.fromhex(artifacts['aes']['iv'])
encrypted_data = bytes.fromhex(encrypted_response['encrypted']['data'])

cipher = AES.new(aes_key, AES.MODE_CBC, iv)
decrypted = cipher.decrypt(encrypted_data)
message = decrypted[:-decrypted[-1]].decode()  # ลบ PKCS7 padding
```

#### ขั้นตอนที่ 5: ตรวจสอบลายเซ็น RSA (ไม่บังคับ)
```python
from Crypto.PublicKey import RSA
from Crypto.Signature import pkcs1_15
from Crypto.Hash import SHA256

# GET /api/c1/signature
public_key = RSA.import_key(artifacts['rsa']['publicKey'])
h = SHA256.new(message.encode())
pkcs1_15.new(public_key).verify(h, signature_bytes)
```

#### ขั้นตอนที่ 6: สร้าง FLAG_1
```python
flag_data = message + "1990" + signature_hex
FLAG_1 = f"MUT{{{hashlib.sha256(flag_data.encode()).hexdigest()[:32]}}}"
```

---

### ส่งคำตอบ
```bash
curl -X POST http://localhost:3001/api/c1/submit-flag \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flag": "MUT{your_flag_here}"}'
```

---

## ด่าน 2: Authentication (3 ปัจจัย)

### คำใบ้
| ปัจจัย | คำใบ้ |
|--------|--------|
| **Email OTP** | กรอกอีเมลจริง → จะได้ OTP และคำใบ้ทางอีเมล |
| **รหัสผ่าน** | ดูคำใบ้แบบสลับตัวอักษรในอีเมล |
| **PIN** | ดูซองจดหมายในอีเมล - รหัสไปรษณีย์คืออะไร? |

### วิธีทำ

```bash
# ปัจจัยที่ 1: Email OTP
# ส่ง OTP
curl -X POST http://localhost:3001/api/c2/email/send-otp \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
# จะได้ demoOTP ในการตอบกลับ

# ยืนยัน OTP (ใช้ค่า demoOTP ที่ได้)
curl -X POST http://localhost:3001/api/c2/email/verify-otp \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"otp": "123456"}'

# ปัจจัยที่ 2: รหัสผ่าน (ดูคำใบ้ในอีเมล แล้วเรียงตัวอักษรให้ถูกต้อง)
curl -X POST http://localhost:3001/api/c2/password \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password": "YOUR_UNSCRAMBLED_PASSWORD"}'

# ปัจจัยที่ 3: PIN (ดูซองจดหมายในอีเมล - รหัสไปรษณีย์คืออะไร?)
curl -X POST http://localhost:3001/api/c2/pin \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pin": "YOUR_POSTAL_CODE"}'

# รับ FLAG_2
curl http://localhost:3001/api/c2/mfa/status \
  -H "Authorization: Bearer $SESSION_TOKEN"

# ส่ง FLAG_2 (หรือใช้ช่องกรอกใน UI)
curl -X POST http://localhost:3001/api/c2/submit-flag \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flag": "MUT{...}"}'
```

---

## ด่าน 3: Authorization (2 ช่องโหว่)

### ขั้นตอนที่ 1: อัพเกรดบทบาท
```bash
curl -X POST http://localhost:3001/api/c3/request-access \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resource": "any", "reason": "any"}'
```
ผลลัพธ์: บทบาทเปลี่ยนจาก Student → Researcher

### ขั้นตอนที่ 2: เข้าถึงไฟล์ลับที่สุด
```bash
curl -X POST http://localhost:3001/api/c3/declassify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resource": "FINAL_FLAG.txt",
    "requester_role": "Director",
    "reason": "any"
  }'
```

### ขั้นตอนที่ 3: รับและส่ง Flag
```bash
# รับ flag
curl http://localhost:3001/api/c3/final-flag \
  -H "Authorization: Bearer $TOKEN"

# ส่ง flag
curl -X POST http://localhost:3001/api/c3/submit-flag \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flag": "MUT{...}"}'
```

---

## สรุปข้อมูลสำคัญ

| ข้อมูล | ค่า |
|--------|-----|
| ปีก่อตั้ง มทส. | 1990 |
| รหัสไปรษณีย์นครราชสีมา | 30000 |
| รหัสผ่าน | ดูคำใบ้ในอีเมล (ตัวอักษรสลับ) |
| PIN | ดูซองจดหมายในอีเมล |

---

## เคล็ดลับ

1. **ใช้โหมดง่าย** - ด่าน 1 มี `/api/c1/easy-decrypt` ที่ทำให้อัตโนมัติ
2. **อ่านคำใบ้ใน API** - ทุก endpoint มีคำใบ้ชัดเจน
3. **ใช้ curl หรือ Postman** - ง่ายกว่าเขียนโค้ดเอง

ขอให้โชคดี!
