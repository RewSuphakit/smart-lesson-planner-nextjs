require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  let id = args[0] || process.env.LINE_CHANNEL_ID;
  let secret = args[1] || process.env.LINE_CHANNEL_SECRET;
  let token = args[2] || process.env.LINE_CHANNEL_ACCESS_TOKEN;

  id = id?.trim().replace(/^["']|["']$/g, '') || 'line-channel';
  secret = secret?.trim().replace(/^["']|["']$/g, '');
  token = token?.trim().replace(/^["']|["']$/g, '');

  if (!secret || !token) {
    console.log('ENV_STATUS: NOT_SAVED_YET');
    console.log('LINE_CHANNEL_ID:', !!id && id !== 'line-channel');
    console.log('LINE_CHANNEL_SECRET:', !!secret);
    console.log('LINE_CHANNEL_ACCESS_TOKEN:', !!token);
    return;
  }

  const user = await prisma.user.findFirst({
    orderBy: { id: 'asc' },
    select: { id: true, email: true },
  });

  if (!user) {
    console.log('ENV_STATUS: NO_USER_IN_DB');
    return;
  }

  await prisma.lineChannelConfig.upsert({
    where: { userId: user.id },
    update: {
      channelId: id,
      channelSecret: secret,
      channelAccessToken: token,
      isActive: true,
    },
    create: {
      userId: user.id,
      channelId: id,
      channelSecret: secret,
      channelAccessToken: token,
      isActive: true,
    },
  });

  console.log('ENV_STATUS: SYNCED_SUCCESS_TO_DB');
}

main()
  .catch((err) => console.error('SYNC_ERROR:', err.message))
  .finally(() => prisma.$disconnect());

