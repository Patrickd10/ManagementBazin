import "server-only";

import { prisma } from "./prisma";

const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000;

const globalForMaintenance = globalThis as unknown as {
  lastMaintenanceAt?: number;
  maintenancePromise?: Promise<void>;
};

function monthsAgo(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

export async function runMaintenance() {
  const lastRun = globalForMaintenance.lastMaintenanceAt ?? 0;
  const nowTime = Date.now();

  if (nowTime - lastRun < MAINTENANCE_INTERVAL_MS) {
    return;
  }

  if (globalForMaintenance.maintenancePromise) {
    return globalForMaintenance.maintenancePromise;
  }

  globalForMaintenance.maintenancePromise = runMaintenanceNow()
    .then(() => {
      globalForMaintenance.lastMaintenanceAt = Date.now();
    })
    .finally(() => {
      globalForMaintenance.maintenancePromise = undefined;
    });

  return globalForMaintenance.maintenancePromise;
}

async function runMaintenanceNow() {
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
