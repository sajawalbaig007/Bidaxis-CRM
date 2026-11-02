import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SEED_USERS } from "../src/constants/seedUsers";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("TrioA15A20S30@", 10);

  for (const user of SEED_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        password: hashedPassword,
        name: user.name,
        role: user.role,
        isActive: true,
        ...(user.csrCode ? { csrCode: user.csrCode } : {}),
      },
      create: {
        name: user.name,
        email: user.email,
        password: hashedPassword,
        role: user.role,
        isActive: true,
        ...(user.csrCode ? { csrCode: user.csrCode } : {}),
      },
    });
  }

  const companyHash = await bcrypt.hash("TrioA15A20S30@", 12);
  await prisma.companyCredential.upsert({
    where: { company: "BEM" },
    update: { username: "BEM", password: companyHash },
    create: { company: "BEM", username: "BEM", password: companyHash },
  });
  await prisma.companyCredential.upsert({
    where: { company: "GPS" },
    update: { username: "GPS", password: companyHash },
    create: { company: "GPS", username: "GPS", password: companyHash },
  });

  const allUsers = await prisma.user.updateMany({
    data: { password: hashedPassword, isActive: true },
  });

  console.log(`Seed complete. ${SEED_USERS.length} seed accounts. ${allUsers.count} users now use the seed password.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
