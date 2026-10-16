require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dotenvResult = require('dotenv').config();
  const allKeys = Object.keys(dotenvResult.parsed || {});
  console.log('Total keys in env file:', allKeys.length);
  console.log('All key names in env:', allKeys);

  const args = process.argv.slice(2);
  let id = args[0] || process.env.LINE_CHANNEL_ID || process.env.channel_id;
  let secret = args[1] || process.env.LINE_CHANNEL_SECRET || process.env.channel_secret;
  let token = args[2] || process.env.LINE_CHANNEL_ACCESS_TOKEN || process.env.channel_access_token;

  id = id?.trim().replace(/^["']|["']$/g, '') || 'line-channel';
  secret = secret?.trim().replace(/^["']|["']$/g, '');
  token = token?.trim().replace(/^["']|["']$/g, '');

  if (!secret || !token) {
    console.log('STATUS: MISSING_SECRET_OR_TOKEN');
    return;
  }

  const user = await prisma.user.findFirst({
    orderBy: { id: 'asc' },
    select: { id: true, email: true },
  });

  if (!user) {
    console.log('STATUS: NO_USER_IN_DB');
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

  console.log('STATUS: SYNCED_SUCCESS_TO_DB for user ID:', user.id);
}

main()
  .catch((err) => console.error('SYNC_ERROR:', err.message))
  .finally(() => prisma.$disconnect());
