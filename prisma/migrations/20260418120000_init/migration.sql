-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "invoiceCompany" TEXT,
    "invoiceStreet" TEXT,
    "invoiceZip" TEXT,
    "invoiceCity" TEXT,
    "invoiceCountry" TEXT,
    "invoiceVatId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Location_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "internalNote" TEXT,
    "serialNumber" TEXT,
    "category" TEXT NOT NULL,
    "locationId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "purchasePrice" REAL,
    "dailyRate" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "rentalBundleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Equipment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "instanceCode" TEXT NOT NULL,
    "serialNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "defectNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EquipmentInstance_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Rental" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "totalPrice" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "googleCalendarEventId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Rental_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Rental_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentalItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rentalId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "dailyRate" REAL NOT NULL,
    "totalPrice" REAL NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RentalItem_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RentalItem_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentOwnership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownedUnits" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EquipmentOwnership_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EquipmentOwnership_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentOwnershipLot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "label" TEXT,
    "units" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EquipmentOwnershipLot_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentOwnershipLotShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "fraction" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EquipmentOwnershipLotShare_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "EquipmentOwnershipLot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EquipmentOwnershipLotShare_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentalItemOwnerShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rentalItemId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownedUnitsAtRental" REAL NOT NULL,
    "ownerFraction" REAL NOT NULL,
    "allocatedQuantity" REAL NOT NULL,
    "shareAmount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RentalItemOwnerShare_rentalItemId_fkey" FOREIGN KEY ("rentalItemId") REFERENCES "RentalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RentalItemOwnerShare_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "pdfCompanyLine" TEXT,
    "pdfContactLine" TEXT,
    "pdfFooterLine" TEXT,
    "rentalDefaultStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "rentalDiscountAllowed" BOOLEAN NOT NULL DEFAULT true,
    "rentalMinDays" INTEGER NOT NULL DEFAULT 1,
    "googleCalendarSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "googleCalendarId" TEXT,
    "googleCalendarRefreshTokenEnc" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_EquipmentOwners" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_EquipmentOwners_A_fkey" FOREIGN KEY ("A") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_EquipmentOwners_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_RentedInstances" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_RentedInstances_A_fkey" FOREIGN KEY ("A") REFERENCES "EquipmentInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_RentedInstances_B_fkey" FOREIGN KEY ("B") REFERENCES "RentalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_equipmentCode_key" ON "Equipment"("equipmentCode");

-- CreateIndex
CREATE INDEX "Equipment_rentalBundleId_idx" ON "Equipment"("rentalBundleId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentInstance_instanceCode_key" ON "EquipmentInstance"("instanceCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentOwnership_equipmentId_ownerId_key" ON "EquipmentOwnership"("equipmentId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentOwnershipLotShare_lotId_ownerId_key" ON "EquipmentOwnershipLotShare"("lotId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalItemOwnerShare_rentalItemId_ownerId_key" ON "RentalItemOwnerShare"("rentalItemId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "_EquipmentOwners_AB_unique" ON "_EquipmentOwners"("A", "B");

-- CreateIndex
CREATE INDEX "_EquipmentOwners_B_index" ON "_EquipmentOwners"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_RentedInstances_AB_unique" ON "_RentedInstances"("A", "B");

-- CreateIndex
CREATE INDEX "_RentedInstances_B_index" ON "_RentedInstances"("B");
