-- Allow rental-specific reassignment of settlement owner shares.
ALTER TABLE "RentalItemOwnerShare" ADD COLUMN "settlementOwnerId" TEXT;
ALTER TABLE "RentalItemOwnerShare" ADD COLUMN "settlementReason" TEXT;
CREATE INDEX "RentalItemOwnerShare_settlementOwnerId_idx" ON "RentalItemOwnerShare"("settlementOwnerId");
