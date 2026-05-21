import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("123456", 10);

  // ADMIN
  await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@gmail.com",
      password: hashedPassword,
      role: Role.admin,
    },
  });

  // CSR
  await prisma.user.create({
    data: {
      name: "CSR User",
      email: "csr@gmail.com",
      password: hashedPassword,
      role: Role.csr,
    },
  });

  console.log("Users created successfully");
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });