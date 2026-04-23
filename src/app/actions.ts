"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PrismaClient } from "@prisma/client";
import { login, logout, requireSession } from "@/lib/auth";
import { runMaintenance } from "@/lib/maintenance";
import { prisma } from "@/lib/prisma";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function loginAction(_: unknown, formData: FormData) {
  const nume = String(formData.get("nume") || "").trim();
  const password = String(formData.get("password") || "");

  if (!nume || !password) {
    return { ok: false, message: "Completeaza numele si parola." };
  }

  const ok = await login(nume, password);

  if (!ok) {
    return { ok: false, message: "Nume sau parola gresita." };
  }

  revalidatePath("/");
  redirect("/");
}

export async function logoutAction() {
  await logout();
  revalidatePath("/");
}

function parseRequiredText(formData: FormData, name: string, label: string) {
  const value = String(formData.get(name) || "").trim();

  if (!value) {
    throw new Error(`Completeaza campul ${label}.`);
  }

  return value;
}

function parseOptionalText(formData: FormData, name: string) {
  const value = String(formData.get(name) || "").trim();
  return value || null;
}

function parseRequiredDate(formData: FormData, name: string, label: string) {
  const value = parseRequiredText(formData, name, label);
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Data pentru ${label} nu este valida.`);
  }

  return date;
}

function parseSubscriptionId(formData: FormData) {
  const tipAbonamentId = Number(formData.get("tip_abonament_id"));

  if (!Number.isInteger(tipAbonamentId)) {
    throw new Error("Alege un abonament.");
  }

  return tipAbonamentId;
}

export async function createStudentAction(formData: FormData) {
  try {
    await requireSession();
    await runMaintenance();

    const nume = parseRequiredText(formData, "nume", "nume elev");
    const dataNasterii = parseRequiredDate(formData, "data_nasterii", "data nasterii");
    const numeParinte = parseOptionalText(formData, "nume_parinte") ?? "-";
    const telefonParinte = parseOptionalText(formData, "telefon_parinte") ?? "-";
    const dataStartAbonament = parseRequiredDate(
      formData,
      "data_start_abonament",
      "start abonament",
    );
    const tipAbonamentId = parseSubscriptionId(formData);

    const abonament = await prisma.abonament.findUnique({
      where: { id: tipAbonamentId },
    });

    if (!abonament) {
      throw new Error("Abonamentul ales nu exista.");
    }

    await prisma.elev.create({
      data: {
        nume,
        data_nasterii: dataNasterii,
        nume_parinte: numeParinte,
        telefon_parinte: telefonParinte,
        tip_abonament_id: abonament.id,
        data_start_abonament: dataStartAbonament,
        intrari_ramase: 0,
      },
    });

    revalidatePath("/");
    return { ok: true, message: "Elevul a fost adaugat." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Operatia a esuat.",
    };
  }
}

export async function renewStudentAction(elevId: number, formData: FormData) {
  try {
    await requireSession();
    await runMaintenance();

    const tipAbonamentId = parseSubscriptionId(formData);
    const useToday = formData.get("use_today") === "on";
    const dataStartAbonament = useToday
      ? new Date()
      : parseRequiredDate(formData, "data_start_abonament", "start abonament");

    await prisma.$transaction(async (tx: TransactionClient) => {
      const elev = await tx.elev.findUnique({
        where: { id: elevId },
        select: {
          id: true,
          activ: true,
          data_start_abonament: true,
        },
      });

      if (!elev?.activ) {
        throw new Error("Elevul nu este activ.");
      }

      const abonament = await tx.abonament.findUnique({
        where: { id: tipAbonamentId },
      });

      if (!abonament) {
        throw new Error("Abonamentul ales nu exista.");
      }

      await tx.elev.update({
        where: { id: elev.id },
        data: {
          tip_abonament_id: abonament.id,
          data_start_abonament: dataStartAbonament,
          intrari_ramase: 0,
          data_ultimei_intrari: null,
        },
      });
    });

    revalidatePath("/");
    return { ok: true, message: "Abonamentul a fost reinnoit." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Operatia a esuat.",
    };
  }
}

export async function addEntryAction(elevId: number) {
  try {
    await requireSession();
    await runMaintenance();

    await prisma.$transaction(async (tx: TransactionClient) => {
      const elev = await tx.elev.findUnique({
        where: { id: elevId },
        select: {
          id: true,
          activ: true,
          data_start_abonament: true,
        },
      });

      if (!elev?.activ) {
        throw new Error("Elevul nu este activ.");
      }

      const intrare = await tx.intrare.create({
        data: {
          elev_id: elev.id,
        },
      });

      await tx.elev.update({
        where: { id: elev.id },
        data: {
          ...(elev.data_start_abonament > intrare.data_intrare
            ? { data_start_abonament: startOfToday() }
            : {}),
          data_ultimei_intrari: intrare.data_intrare,
        },
      });
    });

    revalidatePath("/");
    return { ok: true, message: "Intrarea a fost salvata." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Operatia a esuat.",
    };
  }
}

export async function removeLastEntryAction(elevId: number) {
  try {
    await requireSession();
    await runMaintenance();

    await prisma.$transaction(async (tx: TransactionClient) => {
      const elev = await tx.elev.findUnique({
        where: { id: elevId },
        select: {
          id: true,
          activ: true,
        },
      });

      if (!elev?.activ) {
        throw new Error("Elevul nu este activ.");
      }

      const lastEntry = await tx.intrare.findFirst({
        where: { elev_id: elev.id },
        orderBy: { data_intrare: "desc" },
      });

      if (!lastEntry) {
        throw new Error("Elevul nu are intrari de sters.");
      }

      await tx.intrare.delete({
        where: { id: lastEntry.id },
      });

      const previousEntry = await tx.intrare.findFirst({
        where: { elev_id: elev.id },
        orderBy: { data_intrare: "desc" },
      });

      await tx.elev.update({
        where: { id: elev.id },
        data: {
          data_ultimei_intrari: previousEntry?.data_intrare ?? null,
        },
      });
    });

    revalidatePath("/");
    return { ok: true, message: "Ultima intrare a fost stearsa." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Operatia a esuat.",
    };
  }
}

export async function deleteStudentAction(elevId: number) {
  try {
    await requireSession();
    await runMaintenance();

    await prisma.$transaction(async (tx: TransactionClient) => {
      const elev = await tx.elev.findUnique({
        where: { id: elevId },
      });

      if (!elev) {
        throw new Error("Elevul nu exista.");
      }

      const now = new Date();

      await tx.elevVechi.create({
        data: {
          nume: elev.nume,
          data_nasterii: elev.data_nasterii,
          nume_parinte: elev.nume_parinte,
          telefon_parinte: elev.telefon_parinte,
          tip_abonament_id: elev.tip_abonament_id,
          activ: false,
          data_stergere: now,
          data_expirare_pastrare: addMonths(now, 3),
        },
      });

      await tx.elev.delete({
        where: { id: elev.id },
      });
    });

    revalidatePath("/");
    return { ok: true, message: "Elevul a fost mutat la stersi." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Operatia a esuat.",
    };
  }
}

export async function restoreStudentAction(elevVechiId: number) {
  try {
    await requireSession();
    await runMaintenance();

    await prisma.$transaction(async (tx: TransactionClient) => {
      const elevVechi = await tx.elevVechi.findUnique({
        where: { id: elevVechiId },
      });

      if (!elevVechi) {
        throw new Error("Elevul sters nu exista.");
      }

      const abonament = await tx.abonament.findUnique({
        where: { id: elevVechi.tip_abonament_id },
      });

      if (!abonament) {
        throw new Error("Abonamentul elevului nu mai exista.");
      }

      await tx.elev.create({
        data: {
          nume: elevVechi.nume,
          data_nasterii: elevVechi.data_nasterii,
          nume_parinte: elevVechi.nume_parinte,
          telefon_parinte: elevVechi.telefon_parinte,
          tip_abonament_id: elevVechi.tip_abonament_id,
          data_start_abonament: new Date(),
          intrari_ramase: 0,
          activ: true,
        },
      });

      await tx.elevVechi.delete({
        where: { id: elevVechi.id },
      });
    });

    revalidatePath("/");
    return { ok: true, message: "Elevul a fost restaurat." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Operatia a esuat.",
    };
  }
}

