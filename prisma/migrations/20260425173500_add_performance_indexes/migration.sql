-- Add indexes for the dashboard read path and maintenance cleanup.
CREATE INDEX "Elev_activ_nume_idx" ON "Elev"("activ", "nume");
CREATE INDEX "Elev_tip_abonament_id_idx" ON "Elev"("tip_abonament_id");
CREATE INDEX "Intrare_elev_id_data_intrare_idx" ON "Intrare"("elev_id", "data_intrare");
CREATE INDEX "Intrare_data_intrare_idx" ON "Intrare"("data_intrare");
CREATE INDEX "ElevVechi_data_stergere_idx" ON "ElevVechi"("data_stergere");
CREATE INDEX "ElevVechi_data_expirare_pastrare_idx" ON "ElevVechi"("data_expirare_pastrare");
