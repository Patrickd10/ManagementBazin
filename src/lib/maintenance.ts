import "server-only";

import { prisma } from "./prisma";

function monthsAgo(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

export async function runMaintenance() {
  const now = new Date();

  await prisma.$transaction([
    prisma.intrare.deleteMany({
      where: {
        data_intrare: {
          lt: monthsAgo(2),
        },
      },
    }),
    prisma.elevVechi.deleteMany({
      where: {
        data_expirare_pastrare: {
          lt: now,
        },
      },
    }),
  ]);
}
