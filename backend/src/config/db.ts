import { PrismaClient } from "@prisma/client";

const raw = process.env.DATABASE_URL ?? "";
const url = raw
  ? `${raw}${raw.includes("?") ? "&" : "?"}pool_timeout=30&connect_timeout=60&socket_timeout=60`
  : raw;

const prisma = new PrismaClient({
  datasources: { db: { url } },
});

export default prisma;