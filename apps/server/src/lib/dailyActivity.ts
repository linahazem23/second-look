import { Prisma } from '@prisma/client';
import { prisma } from './db.js';

function todayUtc(): Date {
  return new Date(new Date().toISOString().slice(0, 10));
}

/**
 * Grants a once-per-calendar-day charge — opening the app grants a feed charge,
 * reacting to a Community consultation grants a water charge. The DailyActivity
 * unique constraint on (userId, kind, day) is what actually prevents a second
 * grant the same day; a P2002 here just means "already claimed today," a safe
 * no-op, not an error — same idiom as awardPoints.
 */
export async function grantDailyActivity(
  userId: string,
  kind: 'feed_checkin' | 'water_reaction',
  chargeField: 'freeFeedCharges' | 'freeWaterCharges'
): Promise<boolean> {
  try {
    await prisma.$transaction([
      prisma.dailyActivity.create({ data: { userId, kind, day: todayUtc() } }),
      prisma.user.update({ where: { id: userId }, data: { [chargeField]: { increment: 1 } } })
    ]);
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false;
    throw err;
  }
}
