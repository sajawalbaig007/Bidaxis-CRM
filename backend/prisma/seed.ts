import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("123456", 10);

  await prisma.user.upsert({
    where:  { email: "admin@gmail.com" },
    update: {},
    create: {
      name:     "Admin User",
      email:    "admin@gmail.com",
      password: hashedPassword,
      role:     Role.admin,
    },
  });

  await prisma.user.upsert({
    where:  { email: "csr@gmail.com" },
    update: {},
    create: {
      name:     "CSR User",
      email:    "csr@gmail.com",
      password: hashedPassword,
      role:     Role.csr,
      csrCode:  "CSR001",
    },
  });

  await prisma.user.upsert({
    where:  { email: "manager@gmail.com" },
    update: {},
    create: {
      name:     "Manager User",
      email:    "manager@gmail.com",
      password: hashedPassword,
      role:     Role.manager,
    },
  });

  const companyHash = await bcrypt.hash("123456", 12);
  await prisma.companyCredential.upsert({
    where: { company: "BEM" },
    update: {},
    create: { company: "BEM", username: "BEM", password: companyHash },
  });
  await prisma.companyCredential.upsert({
    where: { company: "GPS" },
    update: {},
    create: { company: "GPS", username: "GPS", password: companyHash },
  });

  console.log("Seed complete");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
