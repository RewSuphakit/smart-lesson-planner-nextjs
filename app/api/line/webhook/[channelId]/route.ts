import { NextRequest, NextResponse } from 'next/server';
import { POST as baseWebhookPost } from '../route';

/**
 * GET /api/line/webhook/[channelId]
 * Health check for channel-specific O(1) LINE webhook endpoint.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  return NextResponse.json({
    status: 'ok',
    channelId,
    message: 'Channel-specific LINE webhook endpoint is running',
  });
}

/**
 * POST /api/line/webhook/[channelId]
 * O(1) LINE webhook handler that looks up the channel configuration directly by `channelId`
 * instead of iterating through all active teacher channels.
 */
export async function POST(request: NextRequest) {
  return baseWebhookPost(request);
}
