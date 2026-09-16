# 🔒 Strict Security Rule: DO NOT READ OR INSPECT .env FILES

## 🚫 Absolute Prohibition
1. **ห้ามอ่าน, ห้ามเปิดดู, ห้าม grep, ห้าม cat, หรือเรียกดูเนื้อหาไฟล์ `.env` หรือไฟล์ตระกูล `.env.*` (เช่น `.env.local`, `.env.production`) โดยเด็ดขาด** (Never view, read, grep, or cat any `.env` file).
2. **ห้ามพิมพ์คำสั่ง shell เพื่อแสดงค่าจาก `.env`** (Do not run commands that echo, print, or expose `.env` contents).
3. **ห้ามเขียนสคริปต์เพื่อ inspect ค่า secrets, passwords, หรือ credentials ใดๆ** จาก `.env` หรือฐานข้อมูล.

## ✅ ขั้นตอนปฏิบัติเมื่อต้องการค่า Environment Variable
- **ถ้าต้องการเพิ่มตัวแปรใหม่ หรือแก้ไขค่าใน `.env` ให้ "บอกผู้ใช้ (USER)" โดยตรงเท่านั้น** (If any environment variable is needed, simply inform the USER to add or configure it themselves).
- **บอกชื่อ Key และตัวอย่าง Template ที่จำเป็น** (เช่น แจ้งผู้ใช้ว่า: *"กรุณาใส่ `SMTP_USER=...` ใน `.env` ของคุณ"* โดยไม่ต้องเปิดดูไฟล์ `.env` ของผู้ใช้เอง).
- AI จะต้องเคารพความเป็นส่วนตัวและความปลอดภัยของข้อมูล Credentials ใน `.env` สูงสุดเสมอ
