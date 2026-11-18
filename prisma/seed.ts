import "dotenv/config";
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

  // const baseUrl =
  //   process.env.SUPPLIER_QUANGVINH_BASE_URL || "https://quangvinhmedia.store/api";
  // const quangVinhApiKey = process.env.SUPPLIER_QUANGVINH_API_KEY;

  const baseUrl =
    process.env.SUPPLIER_SHOPFB2027_BASE_URL ||
    "https://quangvinhmedia.store/api";
  const quangVinhApiKey = process.env.SUPPLIER_SHOPFB2027_API_KEY;

  if (!quangVinhApiKey) {
    throw new Error(
      "Missing SUPPLIER_QUANGVINH_API_KEY in .env — required to mirror supplier catalog",
    );
  }

  // 1. Create or update Quang Vinh Media supplier from .env
  const supplier = await prisma.supplier.upsert({
    where: { name: "Quang Vinh Media" },
    update: {
      adapterKey: "quangvinh",
      baseUrl,
      apiKey: encryptSecret(quangVinhApiKey),
      status: "ACTIVE",
      profitType: "PERCENTAGE",
      profitValue: 10, // lợi nhuận
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
      baseUrl,
      apiKey: encryptSecret(quangVinhApiKey),
      status: "ACTIVE",
      profitType: "PERCENTAGE",
      profitValue: 10, // lợi nhuận
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
  console.log("Base URL:", baseUrl);

  // Auto-sync settings: every 5 minutes by default
  await prisma.supplierSyncSettings.upsert({
    where: { supplierId: supplier.id },
    create: {
      supplierId: supplier.id,
      syncInterval: 300,
      isAutoSyncEnabled: true,
      nextSyncAt: new Date(),
    },
    update: {
      isAutoSyncEnabled: true,
      syncInterval: 300,
    },
  });
  console.log("Auto-sync enabled every 300s — run: npm run worker:sync");

  // 2. Create Admin user if none exists. Credentials come from the environment so a seeded
  // database never ships with a well-known password; the fallback exists for local dev only.
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@digishop.com")
    .trim()
    .toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });
  if (!existingAdmin) {
    if (!adminPassword && process.env.NODE_ENV === "production") {
      console.warn(
        "ADMIN_PASSWORD is not set — skipping admin creation in production",
      );
    } else {
      const passwordHash = await hashPassword(adminPassword || "Admin@123456");
      const admin = await prisma.user.create({
        data: {
          email: adminEmail,
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
      console.log("Admin account created:", admin.email);
      if (!adminPassword) {
        console.log(
          "Using the development default password — set ADMIN_PASSWORD to override",
        );
      }
    }
  }

  // 3. Initial full catalog mirror from supplier API → SupplierProduct + Product
  console.log("Mirroring products from supplier API...");
  try {
    const result = await syncSupplierProducts(supplier.id, "MANUAL");
    console.log("Product sync completed:", result.status);
    console.log("- Total products:", result.totalProducts);
    console.log("- New products:", result.newProducts);
    console.log("- Updated products:", result.updatedProducts);
    console.log("- Price changed:", result.priceChangedProducts);
    console.log("- Deactivated:", result.deactivatedProducts);
    console.log("- Failed:", result.failedProducts);
    if (result.status === "FAILED") {
      console.warn("Sync finished with FAILED status — run: npm run db:sync");
    }
  } catch (err) {
    console.warn(
      "Initial catalog mirror failed:",
      err instanceof Error ? err.message : err,
    );
    console.warn(
      "Supplier row is ready. Fix network/API key then run: npm run db:sync",
    );
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
