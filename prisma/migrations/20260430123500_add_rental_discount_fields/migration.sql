-- Add persisted discount metadata for rental detail display.
ALTER TABLE "Rental" ADD COLUMN "discountType" TEXT;
ALTER TABLE "Rental" ADD COLUMN "discountValue" REAL;
ALTER TABLE "Rental" ADD COLUMN "discountAmount" REAL;
