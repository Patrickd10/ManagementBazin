import { getSession } from "@/lib/auth";
import { runMaintenance } from "@/lib/maintenance";
import { prisma } from "@/lib/prisma";
import { Dashboard, type DeletedStudent, type Student } from "./components/dashboard";
import { LoginForm } from "./components/login-form";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function effectiveSubscriptionStart(start: Date) {
  const now = new Date();
  return start > now ? startOfToday() : start;
}

export default async function Home() {
  const session = await getSession();

  if (!session) {
    return <LoginForm />;
  }

  await runMaintenance();

  const [elevi, abonamente, eleviStersi, intrari] = await Promise.all([
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
        nume: "asc",
      },
    }),
    prisma.elevVechi.findMany({
      orderBy: {
        data_stergere: "desc",
      },
    }),
    prisma.intrare.findMany({
      select: {
        elev_id: true,
        data_intrare: true,
      },
      orderBy: {
        data_intrare: "desc",
      },
    }),
  ]);

  const entriesByStudent = new Map<number, Date[]>();

  for (const intrare of intrari) {
    const studentEntries = entriesByStudent.get(intrare.elev_id) ?? [];
    studentEntries.push(intrare.data_intrare);
    entriesByStudent.set(intrare.elev_id, studentEntries);
  }

  const students: Student[] = elevi.map((elev) => {
    const startAbonament = effectiveSubscriptionStart(elev.data_start_abonament);
    const intrariElev = entriesByStudent.get(elev.id) ?? [];
    const intrariCurente = intrariElev.filter((dataIntrare) => dataIntrare >= startAbonament);

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
      intrariFolosite: intrariCurente.length,
      intrari: intrariCurente.map((dataIntrare) => dataIntrare.toISOString()),
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
      currentDate={startOfToday().toISOString()}
      abonamente={abonamente.map((abonament) => ({
        id: abonament.id,
        nume: abonament.nume,
        numarIntrari: abonament.numar_intrari,
        valabilitateZile: abonament.valabilitate_zile,
      }))}
    />
  );
}
