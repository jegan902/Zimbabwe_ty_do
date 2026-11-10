/**
 * Manual / scheduled entrypoint: mirror all ACTIVE suppliers into the local catalog.
 *
 * Usage:
 *   npx tsx scripts/sync-suppliers.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/utils/db";
import { syncSupplierProducts } from "../src/lib/services/supplier.service";

async function main() {
  const suppliers = await prisma.supplier.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, adapterKey: true },
  });

  if (suppliers.length === 0) {
    console.error("No ACTIVE suppliers. Run: npm run db:seed");
    process.exit(1);
  }

  let failed = 0;
  for (const supplier of suppliers) {
    console.log(`Syncing ${supplier.name} (${supplier.adapterKey})...`);
    try {
      const result = await syncSupplierProducts(supplier.id, "SCHEDULED");
      console.log(
        `  ${result.status}: total=${result.totalProducts} new=${result.newProducts} updated=${result.updatedProducts} priceChanged=${result.priceChangedProducts} deactivated=${result.deactivatedProducts} failed=${result.failedProducts} (${result.durationMs}ms)`
      );
      if (result.status === "FAILED") failed++;
    } catch (err) {
      failed++;
      console.error(`  FAILED:`, err instanceof Error ? err.message : err);
    }
  }

  if (failed > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
