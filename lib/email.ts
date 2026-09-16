import nodemailer from 'nodemailer';
import crypto from 'crypto';

/**
 * Generate a secure 6-digit numeric OTP code.
 */
export function generateOtpCode(): string {
  // Generate random 6-digit number between 100000 and 999999
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}

/**
 * Create Nodemailer transporter based on environment variables.
 */
function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Ignore empty or placeholder template values
  if (
    !user ||
    !pass ||
    user.includes('อีเมลของคุณ') ||
    user.includes('your-email') ||
    pass.includes('รหัสผ่านแอป') ||
    pass.includes('your-password')
  ) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Send 6-digit verification code to the user's email.
 */
export async function sendVerificationEmail(
  toEmail: string,
  name: string,
  code: string
): Promise<{ success: boolean; isDevMode?: boolean; error?: string }> {
  const transporter = getTransporter();

  // If SMTP is not configured, fallback to console log for seamless local testing
  if (!transporter) {
    console.log('\n======================================================');
    console.log(`📧 [EMAIL DEV MODE] SMTP not configured in .env`);
    console.log(`👉 Sending verification code to: ${toEmail} (${name})`);
    console.log(`🔑 VERIFICATION CODE (OTP): >>> ${code} <<<`);
    console.log(`⏰ Code valid for: 15 minutes`);
    console.log('======================================================\n');
    return { success: true, isDevMode: true };
  }

  const fromAddress = process.env.SMTP_FROM || `"Smart Lesson Planner" <${process.env.SMTP_USER}>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; }
        .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .logo { font-size: 24px; font-weight: bold; margin-bottom: 6px; letter-spacing: -0.5px; }
        .subtitle { font-size: 13px; opacity: 0.9; }
        .body { padding: 32px 28px; color: #334155; }
        .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #1e293b; }
        .intro { font-size: 14px; line-height: 1.6; margin-bottom: 24px; color: #64748b; }
        .code-box { background: #f1f5f9; border: 2px dashed #6366f1; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
        .code { font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #4f46e5; margin: 0; font-family: monospace; }
        .expiry { font-size: 12px; color: #94a3b8; margin-top: 8px; }
        .notice { font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 18px; }
        .footer { background: #f8fafc; padding: 18px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Smart Lesson Planner</div>
          <div class="subtitle">ระบบวางแผนการสอนอัจฉริยะสำหรับครูไทย</div>
        </div>
        <div class="body">
          <div class="greeting">สวัสดีครับ/ค่ะ คุณ ${name}</div>
          <div class="intro">
            ขอบคุณที่สมัครใช้งาน Smart Lesson Planner กรุณานำรหัสยืนยัน 6 หลักด้านล่างนี้ไปกรอกในหน้ายืนยันตัวตน เพื่อเปิดใช้งานบัญชีของคุณ:
          </div>
          <div class="code-box">
            <div class="code">${code}</div>
            <div class="expiry">รหัสนี้ใช้ได้ภายใน 15 นาที</div>
          </div>
          <div class="notice">
            * หากคุณไม่ได้เป็นผู้ส่งคำขอสมัครสมาชิกบัญชีนี้ กรุณาเพิกเฉยต่ออีเมลฉบับนี้ บัญชีของคุณจะไม่ถูกเปิดใช้งานจนกว่าจะมีการยืนยันรหัส
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Smart Lesson Planner. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: `[Smart Lesson Planner] รหัสยืนยันการสมัครสมาชิกของคุณคือ ${code}`,
      text: `สวัสดีคุณ ${name},\n\nรหัสยืนยันการสมัครสมาชิก Smart Lesson Planner ของคุณคือ: ${code}\n\nรหัสนี้จะหมดอายุภายใน 15 นาที\n\nหากคุณไม่ได้เป็นผู้สมัครสมาชิก กรุณาเพิกเฉยต่ออีเมลนี้`,
      html: htmlContent,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send verification email via SMTP:', error);
    // Even if SMTP fails, print the OTP to console so testing is not blocked
    console.log(`👉 [FALLBACK OTP for ${toEmail}]: ${code}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

/**
 * Send 6-digit verification code for changing account email address.
 */
export async function sendEmailChangeOtpEmail(
  toEmail: string,
  name: string,
  code: string
): Promise<{ success: boolean; isDevMode?: boolean; error?: string }> {
  const transporter = getTransporter();

  // If SMTP is not configured, fallback to console log for seamless local testing
  if (!transporter) {
    console.log('\n======================================================');
    console.log(`📧 [EMAIL DEV MODE] SMTP not configured in .env`);
    console.log(`👉 Sending EMAIL CHANGE OTP to: ${toEmail} (${name})`);
    console.log(`🔑 CHANGE EMAIL OTP: >>> ${code} <<<`);
    console.log(`⏰ Code valid for: 15 minutes`);
    console.log('======================================================\n');
    return { success: true, isDevMode: true };
  }

  const fromAddress = process.env.SMTP_FROM || `"Smart Lesson Planner" <${process.env.SMTP_USER}>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; }
        .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .logo { font-size: 24px; font-weight: bold; margin-bottom: 6px; letter-spacing: -0.5px; }
        .subtitle { font-size: 13px; opacity: 0.9; }
        .body { padding: 32px 28px; color: #334155; }
        .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #1e293b; }
        .intro { font-size: 14px; line-height: 1.6; margin-bottom: 24px; color: #64748b; }
        .code-box { background: #f0f9ff; border: 2px dashed #0284c7; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
        .code { font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #0284c7; margin: 0; font-family: monospace; }
        .expiry { font-size: 12px; color: #94a3b8; margin-top: 8px; }
        .notice { font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 18px; }
        .footer { background: #f8fafc; padding: 18px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Smart Lesson Planner</div>
          <div class="subtitle">ระบบวางแผนการสอนอัจฉริยะสำหรับครูไทย</div>
        </div>
        <div class="body">
          <div class="greeting">เรียน คุณ ${name}</div>
          <div class="intro">
            ระบบได้รับคำขอเปลี่ยนที่อยู่อีเมลสำหรับบัญชีของคุณ กรุณานำรหัสยืนยัน 6 หลักด้านล่างนี้ไปกรอกเพื่อยืนยันความเป็นเจ้าของอีเมลใหม่:
          </div>
          <div class="code-box">
            <div class="code">${code}</div>
            <div class="expiry">รหัสนี้ใช้ได้ภายใน 15 นาที</div>
          </div>
          <div class="notice">
            * หากคุณไม่ได้เป็นผู้ทำรายการเปลี่ยนอีเมลนี้ กรุณาอย่าเปิดเผยรหัสนี้แก่ผู้อื่น บัญชีเดิมของคุณจะยังคงปลอดภัยและไม่มีการเปลี่ยนแปลงใดๆ
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Smart Lesson Planner. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: `[Smart Lesson Planner] รหัสยืนยันการเปลี่ยนอีเมลของคุณคือ ${code}`,
      text: `เรียนคุณ ${name},\n\nรหัสยืนยันการเปลี่ยนที่อยู่อีเมลใน Smart Lesson Planner ของคุณคือ: ${code}\n\nรหัสนี้จะหมดอายุภายใน 15 นาที\n\nหากคุณไม่ได้เป็นผู้ขอเปลี่ยนอีเมล กรุณาเพิกเฉยต่ออีเมลนี้`,
      html: htmlContent,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send email change OTP via SMTP:', error);
    console.log(`👉 [FALLBACK OTP for ${toEmail}]: ${code}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

/**
 * Send 6-digit OTP code for resetting account password.
 */
export async function sendPasswordResetOtpEmail(
  toEmail: string,
  name: string,
  code: string
): Promise<{ success: boolean; isDevMode?: boolean; error?: string }> {
  const transporter = getTransporter();

  // If SMTP is not configured, fallback to console log for seamless local testing
  if (!transporter) {
    console.log('\n======================================================');
    console.log(`📧 [EMAIL DEV MODE] SMTP not configured in .env`);
    console.log(`👉 Sending PASSWORD RESET OTP to: ${toEmail} (${name})`);
    console.log(`🔑 PASSWORD RESET OTP: >>> ${code} <<<`);
    console.log(`⏰ Code valid for: 15 minutes`);
    console.log('======================================================\n');
    return { success: true, isDevMode: true };
  }

  const fromAddress = process.env.SMTP_FROM || `"Smart Lesson Planner" <${process.env.SMTP_USER}>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; }
        .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #ea580c 50%, #4f46e5 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .logo { font-size: 24px; font-weight: bold; margin-bottom: 6px; letter-spacing: -0.5px; }
        .subtitle { font-size: 13px; opacity: 0.95; }
        .body { padding: 32px 28px; color: #334155; }
        .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #1e293b; }
        .intro { font-size: 14px; line-height: 1.6; margin-bottom: 24px; color: #64748b; }
        .code-box { background: #fffbeb; border: 2px dashed #f59e0b; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
        .code { font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #d97706; margin: 0; font-family: monospace; }
        .expiry { font-size: 12px; color: #b45309; margin-top: 8px; font-weight: 500; }
        .notice { font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 18px; }
        .footer { background: #f8fafc; padding: 18px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Smart Lesson Planner</div>
          <div class="subtitle">ระบบกู้คืนรหัสผ่านความปลอดภัยสูง</div>
        </div>
        <div class="body">
          <div class="greeting">สวัสดี คุณ ${name}</div>
          <div class="intro">
            เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชี Smart Lesson Planner ของคุณ กรุณานำรหัสยืนยัน 6 หลักด้านล่างนี้ไปกรอกเพื่อตั้งรหัสผ่านใหม่:
          </div>
          <div class="code-box">
            <div class="code">${code}</div>
            <div class="expiry">⏰ รหัสนี้มีอายุใช้งาน 15 นาที</div>
          </div>
          <div class="notice">
            * หากคุณไม่ได้เป็นผู้ส่งคำขอนี้ โปรดอย่าเปิดเผยรหัสนี้แก่ใคร รหัสผ่านเดิมของคุณจะยังคงปลอดภัยและไม่มีการเปลี่ยนแปลงใดๆ
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Smart Lesson Planner. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: `[Smart Lesson Planner] รหัสสำหรับรีเซ็ตรหัสผ่านของคุณคือ ${code}`,
      text: `สวัสดีคุณ ${name},\n\nรหัสรีเซ็ตรหัสผ่าน Smart Lesson Planner ของคุณคือ: ${code}\n\nรหัสนี้จะหมดอายุภายใน 15 นาที\n\nหากคุณไม่ได้เป็นผู้ส่งคำขอ กรุณาเพิกเฉยต่ออีเมลนี้`,
      html: htmlContent,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send password reset OTP via SMTP:', error);
    console.log(`👉 [FALLBACK OTP for ${toEmail}]: ${code}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}


