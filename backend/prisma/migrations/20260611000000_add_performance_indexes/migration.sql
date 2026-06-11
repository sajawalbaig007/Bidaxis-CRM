-- CreateIndex: User indexes for O(log n) role/active lookups
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_isActive_idx" ON "User"("isActive");
CREATE INDEX IF NOT EXISTS "User_lastActive_idx" ON "User"("lastActive");
CREATE INDEX IF NOT EXISTS "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex: Lead indexes for O(log n) filtered queries
CREATE INDEX IF NOT EXISTS "Lead_assignedTo_idx" ON "Lead"("assignedTo");
CREATE INDEX IF NOT EXISTS "Lead_status_idx" ON "Lead"("status");
CREATE INDEX IF NOT EXISTS "Lead_phone_idx" ON "Lead"("phone");
CREATE INDEX IF NOT EXISTS "Lead_email_idx" ON "Lead"("email");
CREATE INDEX IF NOT EXISTS "Lead_company_idx" ON "Lead"("company");
CREATE INDEX IF NOT EXISTS "Lead_createdAt_idx" ON "Lead"("createdAt");
CREATE INDEX IF NOT EXISTS "Lead_updatedAt_idx" ON "Lead"("updatedAt");
CREATE INDEX IF NOT EXISTS "Lead_assignedTo_status_idx" ON "Lead"("assignedTo", "status");
CREATE INDEX IF NOT EXISTS "Lead_company_status_idx" ON "Lead"("company", "status");
CREATE INDEX IF NOT EXISTS "Lead_status_assignedTo_idx" ON "Lead"("status", "assignedTo");
