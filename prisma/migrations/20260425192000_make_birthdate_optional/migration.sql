-- Allow students to be created before the birth date is known.
ALTER TABLE "Elev" ALTER COLUMN "data_nasterii" DROP NOT NULL;
ALTER TABLE "ElevVechi" ALTER COLUMN "data_nasterii" DROP NOT NULL;
