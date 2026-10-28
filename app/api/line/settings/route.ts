/**
 * LINE Channel Settings API (per teacher)
 *
 * GET  /api/line/settings — Get current teacher's LINE channel config
 * POST /api/line/settings — Create/update LINE channel config
 * DELETE /api/line/settings — Remove LINE channel config
 *
 * Protected by requireAuth() — only authenticated teachers
 *
 * Security: Channel secrets and access tokens are encrypted at rest
 * using AES-256-GCM when ENCRYPTION_KEY is configured. Falls back
 * to plaintext storage for backward compatibility.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError, handleAuthError } from '@/lib/auth';
import { encrypt, isEncryptionConfigured } from '@/lib/encryption';

// GET — Retrieve current teacher's LINE channel config
export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    let config = await prisma.lineChannelConfig.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        channelId: true,
        // channelSecret and channelAccessToken are sensitive — return masked
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const isEnvConfigured = !!(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN);

    if (!config && !isEnvConfigured) {
      return NextResponse.json({
        data: null,
        message: 'ยังไม่ได้ตั้งค่า LINE Bot',
      });
    }

    const effectiveConfig = config || {
      id: 0,
      channelId: process.env.LINE_CHANNEL_ID || 'env-configured',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Get binding count for this teacher's students
    const bindingCount = await prisma.lineBinding.count({
      where: {
        studentCode: {
          in: await prisma.student.findMany({
            where: { userId: user.id },
            select: { studentCode: true },
          }).then(students =>
            students
              .map(s => s.studentCode)
              .filter((code): code is string => code !== null)
          ),
        },
      },
    });

    // Get webhook URL info
    const webhookUrl = `${getBaseUrl(request)}/api/line/webhook`;

    return NextResponse.json({
      data: {
        ...effectiveConfig,
        channelSecret: '••••••••',
        channelAccessToken: '••••••••',
        bindingCount,
        webhookUrl,
        source: config ? 'database' : 'env',
        encryptionEnabled: isEncryptionConfigured(),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('LINE settings GET error:', error);
    return NextResponse.json({ message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST — Create or update LINE channel config
export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json();

    const { channel_id, channel_secret, channel_access_token } = body;

    // Validation
    if (!channel_id || typeof channel_id !== 'string' || channel_id.trim().length === 0) {
      return NextResponse.json({ message: 'กรุณาระบุ Channel ID' }, { status: 400 });
    }
    if (!channel_secret || typeof channel_secret !== 'string' || channel_secret.trim().length === 0) {
      return NextResponse.json({ message: 'กรุณาระบุ Channel Secret' }, { status: 400 });
    }
    if (!channel_access_token || typeof channel_access_token !== 'string' || channel_access_token.trim().length === 0) {
      return NextResponse.json({ message: 'กรุณาระบุ Channel Access Token' }, { status: 400 });
    }

    // Check if channel_id is already used by another teacher
    const existingChannel = await prisma.lineChannelConfig.findFirst({
      where: {
        channelId: channel_id.trim(),
        userId: { not: user.id },
      },
    });

    if (existingChannel) {
      return NextResponse.json(
        { message: 'Channel ID นี้ถูกใช้งานโดยบัญชีอื่นแล้ว' },
        { status: 409 }
      );
    }

    // Encrypt sensitive values if ENCRYPTION_KEY is available
    const secretValue = isEncryptionConfigured()
      ? encrypt(channel_secret.trim())
      : channel_secret.trim();
    const tokenValue = isEncryptionConfigured()
      ? encrypt(channel_access_token.trim())
      : channel_access_token.trim();

    // Upsert
    const config = await prisma.lineChannelConfig.upsert({
      where: { userId: user.id },
      update: {
        channelId: channel_id.trim(),
        channelSecret: secretValue,
        channelAccessToken: tokenValue,
        isActive: true,
      },
      create: {
        userId: user.id,
        channelId: channel_id.trim(),
        channelSecret: secretValue,
        channelAccessToken: tokenValue,
        isActive: true,
      },
    });

    const webhookUrl = `${getBaseUrl(request)}/api/line/webhook`;

    return NextResponse.json({
      message: 'บันทึกการตั้งค่า LINE Bot สำเร็จ',
      data: {
        id: config.id,
        channelId: config.channelId,
        isActive: config.isActive,
        webhookUrl,
        encryptionEnabled: isEncryptionConfigured(),
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('LINE settings POST error:', error);
    return NextResponse.json({ message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PATCH — Toggle active status
export async function PATCH(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json();

    const config = await prisma.lineChannelConfig.findUnique({
      where: { userId: user.id },
    });

    if (!config) {
      return NextResponse.json({ message: 'ยังไม่ได้ตั้งค่า LINE Bot' }, { status: 404 });
    }

    const isActive = typeof body.is_active === 'boolean' ? body.is_active : !config.isActive;

    await prisma.lineChannelConfig.update({
      where: { userId: user.id },
      data: { isActive },
    });

    return NextResponse.json({
      message: isActive ? 'เปิดใช้งาน LINE Bot แล้ว' : 'ปิดใช้งาน LINE Bot แล้ว',
      data: { isActive },
    });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('LINE settings PATCH error:', error);
    return NextResponse.json({ message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE — Remove LINE channel config and all related bindings
export async function DELETE(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const config = await prisma.lineChannelConfig.findUnique({
      where: { userId: user.id },
    });

    if (!config) {
      return NextResponse.json({ message: 'ไม่มีการตั้งค่า LINE Bot ที่จะลบ' }, { status: 404 });
    }

    // Delete bindings for students of this teacher
    const studentCodes = await prisma.student.findMany({
      where: { userId: user.id },
      select: { studentCode: true },
    }).then(students =>
      students
        .map(s => s.studentCode)
        .filter((code): code is string => code !== null)
    );

    if (studentCodes.length > 0) {
      await prisma.lineBinding.deleteMany({
        where: { studentCode: { in: studentCodes } },
      });
    }

    await prisma.lineChannelConfig.delete({
      where: { userId: user.id },
    });

    return NextResponse.json({
      message: 'ลบการตั้งค่า LINE Bot และข้อมูลการผูกบัญชีทั้งหมดเรียบร้อย',
    });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError();
    console.error('LINE settings DELETE error:', error);
    return NextResponse.json({ message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// ==================== Helpers ====================

function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}
