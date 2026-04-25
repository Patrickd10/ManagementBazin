import { getSession } from "@/lib/auth";
import { runMaintenance } from "@/lib/maintenance";
import { prisma } from "@/lib/prisma";
import { Dashboard, type DeletedStudent, type Student } from "./components/dashboard";
import { LoginForm } from "./components/login-form";

type EntryCountRow = {
  elev_id: number;
  intrari_folosite: number | bigint | string;
};

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function effectiveSubscriptionStart(start: Date) {
  const now = new Date();
  return start > now ? startOfToday() : start;
}

function numberFromDb(value: number | bigint | string) {
  return typeof value === "bigint" ? Number(value) : Number(value);
}

export default async function Home() {
  const session = await getSession();

  if (!session) {
    return <LoginForm />;
  }

  await runMaintenance();

  const today = startOfToday();
  const [elevi, abonamente, eleviStersi, entryCounts] = await Promise.all([
    prisma.elev.findMany({
      where: {
        activ: true,
      },
      include: {
        abonament: true,
      },
      orderBy: {
        nume: "asc",
      },
    }),
    prisma.abonament.findMany({
      orderBy: {
        numar_intrari: "asc",
      },
    }),
    prisma.elevVechi.findMany({
      orderBy: {
        data_stergere: "desc",
      },
    }),
    prisma.$queryRaw<EntryCountRow[]>`
      SELECT
        e.id AS elev_id,
        COUNT(i.id)::int AS intrari_folosite
      FROM "Elev" e
      LEFT JOIN "Intrare" i
        ON i.elev_id = e.id
        AND i.data_intrare >= CASE
          WHEN e.data_start_abonament > NOW() THEN ${today}
          ELSE e.data_start_abonament
        END
      WHERE e.activ = true
      GROUP BY e.id
    `,
  ]);

  const entryCountByStudent = new Map(
    entryCounts.map((row) => [row.elev_id, numberFromDb(row.intrari_folosite)]),
  );

  const students: Student[] = elevi.map((elev) => {
    const startAbonament = effectiveSubscriptionStart(elev.data_start_abonament);

    return {
      id: elev.id,
      nume: elev.nume,
      dataNasterii: elev.data_nasterii.toISOString(),
      numeParinte: elev.nume_parinte,
      telefonParinte: elev.telefon_parinte,
      dataStartAbonament: startAbonament.toISOString(),
      dataUltimeiIntrari: elev.data_ultimei_intrari?.toISOString() ?? null,
      abonament: {
        id: elev.abonament.id,
        nume: elev.abonament.nume,
        numarIntrari: elev.abonament.numar_intrari,
        valabilitateZile: elev.abonament.valabilitate_zile,
      },
      intrariFolosite: entryCountByStudent.get(elev.id) ?? 0,
    };
  });

  const subscriptionById = new Map(abonamente.map((abonament) => [abonament.id, abonament]));
  const deletedStudents: DeletedStudent[] = eleviStersi.map((elev) => {
    const abonament = subscriptionById.get(elev.tip_abonament_id);

    return {
      id: elev.id,
      nume: elev.nume,
      dataNasterii: elev.data_nasterii.toISOString(),
      numeParinte: elev.nume_parinte,
      telefonParinte: elev.telefon_parinte,
      dataStergere: elev.data_stergere.toISOString(),
      dataExpirarePastrare: elev.data_expirare_pastrare.toISOString(),
      abonament: abonament
        ? {
            id: abonament.id,
            nume: abonament.nume,
            numarIntrari: abonament.numar_intrari,
            valabilitateZile: abonament.valabilitate_zile,
          }
        : null,
    };
  });

  return (
    <Dashboard
      antrenor={session.nume}
      elevi={students}
      eleviStersi={deletedStudents}
      currentDate={today.toISOString()}
      abonamente={abonamente.map((abonament) => ({
        id: abonament.id,
        nume: abonament.nume,
        numarIntrari: abonament.numar_intrari,
        valabilitateZile: abonament.valabilitate_zile,
      }))}
    />
  );
}
