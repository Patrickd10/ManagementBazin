-- CreateTable
CREATE TABLE "Antrenor" (
    "id" SERIAL NOT NULL,
    "nume" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,

    CONSTRAINT "Antrenor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Abonament" (
    "id" SERIAL NOT NULL,
    "nume" TEXT NOT NULL,
    "numar_intrari" INTEGER NOT NULL,
    "valabilitate_zile" INTEGER NOT NULL,

    CONSTRAINT "Abonament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Elev" (
    "id" SERIAL NOT NULL,
    "nume" TEXT NOT NULL,
    "data_nasterii" TIMESTAMP(3) NOT NULL,
    "nume_parinte" TEXT NOT NULL,
    "telefon_parinte" TEXT NOT NULL,
    "tip_abonament_id" INTEGER NOT NULL,
    "data_start_abonament" TIMESTAMP(3) NOT NULL,
    "intrari_ramase" INTEGER NOT NULL,
    "activ" BOOLEAN NOT NULL DEFAULT true,
    "data_ultimei_intrari" TIMESTAMP(3),

    CONSTRAINT "Elev_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intrare" (
    "id" SERIAL NOT NULL,
    "elev_id" INTEGER NOT NULL,
    "data_intrare" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Intrare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElevVechi" (
    "id" SERIAL NOT NULL,
    "nume" TEXT NOT NULL,
    "data_nasterii" TIMESTAMP(3) NOT NULL,
    "nume_parinte" TEXT NOT NULL,
    "telefon_parinte" TEXT NOT NULL,
    "tip_abonament_id" INTEGER NOT NULL,
    "activ" BOOLEAN NOT NULL,
    "data_stergere" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_expirare_pastrare" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElevVechi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Antrenor_nume_key" ON "Antrenor"("nume");

-- AddForeignKey
ALTER TABLE "Elev" ADD CONSTRAINT "Elev_tip_abonament_id_fkey" FOREIGN KEY ("tip_abonament_id") REFERENCES "Abonament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intrare" ADD CONSTRAINT "Intrare_elev_id_fkey" FOREIGN KEY ("elev_id") REFERENCES "Elev"("id") ON DELETE CASCADE ON UPDATE CASCADE;
