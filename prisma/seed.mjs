import { randomUUID, scryptSync } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg(process.env.DATABASE_URL || "");
const prisma = new PrismaClient({ adapter });

function hashPassword(password) {
  const salt = randomUUID();
  const key = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${key}`;
}

async function upsertAbonament(nume, numarIntrari, valabilitateZile, aliases = []) {
  const existing = await prisma.abonament.findFirst({
    where: {
      OR: [nume, ...aliases].map((candidate) => ({ nume: candidate })),
    },
  });

  if (existing) {
    return prisma.abonament.update({
      where: { id: existing.id },
      data: {
        nume,
        numar_intrari: numarIntrari,
        valabilitate_zile: valabilitateZile,
      },
    });
  }

  return prisma.abonament.create({
    data: {
      nume,
      numar_intrari: numarIntrari,
      valabilitate_zile: valabilitateZile,
    },
  });
}

async function main() {
  await prisma.antrenor.upsert({
    where: { nume: "antrenor" },
    update: { passwordHash: hashPassword("inot") },
    create: {
      nume: "antrenor",
      passwordHash: hashPassword("inot"),
    },
  });

  await upsertAbonament("Abonament 8", 8, 30, [
    "ABONAMENT INITIERE INOT COPII / ADULTI",
  ]);
  await upsertAbonament("Abonament 12", 12, 30, ["ABONAMENT PERFECTIONARE"]);
  await upsertAbonament("PERFORMANTA", 30, 30, [
    "ABONAMENT GRUPE PERFORMANTA INOT SI POLO PE APA",
  ]);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed complet: antrenor/inot si cele 3 abonamente sunt pregatite.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
