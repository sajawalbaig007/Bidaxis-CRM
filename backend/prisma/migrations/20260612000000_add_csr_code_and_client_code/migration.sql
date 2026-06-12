-- Add csrCode to User (unique identifier like "1000", "1001")
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "csrCode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_csrCode_key" ON "User"("csrCode");

-- Add clientCode to Lead (auto-assigned on Close Client, format: "1000-01")
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "clientCode" TEXT;
