import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { encryptSecret } from "../src/lib/suppliers/http";
import { syncSupplierProducts } from "../src/lib/services/supplier.service";
import { hashPassword } from "../src/lib/utils/crypto";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://marketplace:marketplace_dev_password@localhost:5432/marketplace?schema=public";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // 1. Create or update Quang Vinh Media supplier
  const quangVinhApiKey =
    process.env.SUPPLIER_QUANGVINH_API_KEY ||
    "194bd3c677f5969052b28cb294e4999cC6TvV0N5gOu9A3YZ4pFmknebtshS1GME";

  const supplier = await prisma.supplier.upsert({
    where: { name: "Quang Vinh Media" },
    update: {
      adapterKey: "quangvinh",
      baseUrl: process.env.SUPPLIER_QUANGVINH_BASE_URL || "https://quangvinhmedia.store/api",
      apiKey: encryptSecret(quangVinhApiKey),
      status: "ACTIVE",
      profitType: "PERCENTAGE",
      profitValue: 20,
      supportsBalanceApi: true,
      supportsStock: true,
      connectionStatus: "CONNECTED",
      balance: {
        upsert: {
          create: {
            balance: 0,
            alertThreshold: 50000,
          },
          update: {
            alertThreshold: 50000,
          },
        },
      },
    },
    create: {
      name: "Quang Vinh Media",
      adapterKey: "quangvinh",
      baseUrl: process.env.SUPPLIER_QUANGVINH_BASE_URL || "https://quangvinhmedia.store/api",
      apiKey: encryptSecret(quangVinhApiKey),
      status: "ACTIVE",
      profitType: "PERCENTAGE",
      profitValue: 20,
      supportsBalanceApi: true,
      supportsStock: true,
      connectionStatus: "CONNECTED",
      balance: {
        create: {
          balance: 0,
          alertThreshold: 50000,
        },
      },
    },
  });

  console.log("Supplier ready:", supplier.name, "(id:", supplier.id, ")");

  // 2. Create Admin user if none exists
  const adminEmail = "admin@digishop.com";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await hashPassword("Admin@123456");
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        username: "admin",
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
        fullName: "Administrator",
        wallet: {
          create: {
            balance: 1000000,
            currency: "VND",
          },
        },
      },
    });
    console.log("Admin account created:", admin.email, "(Password: Admin@123456)");
  }

  // 3. Trigger initial product sync from Quang Vinh Media live API
  console.log("Syncing products from supplier API...");
  try {
    const result = await syncSupplierProducts(supplier.id, "MANUAL");
    console.log("Product sync completed successfully!");
    console.log("- Total products:", result.totalProducts);
    console.log("- New products:", result.newProducts);
    console.log("- Updated products:", result.updatedProducts);
  } catch (err) {
    console.error("Product sync failed:", (err as Error).message);
  }
}

main()
  .then(() => {
    console.log("Seed finished.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  });

