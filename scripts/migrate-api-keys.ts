/**
 * One-shot backfill: rewrite every plaintext partner API key as
 * `apiKeyHash` (lookup) + `apiKeyEnc` (AES-256-GCM, for display) and clear the
 * legacy column.
 *
 * Run once after the migration:  npx tsx scripts/migrate-api-keys.ts
 * Runtime code also migrates a key lazily on first successful partner call, so a
 * key created between the migration and this script is never locked out.
 */
import "dotenv/config";
import { prisma } from "../src/lib/utils/db";
import { apiKeyColumns, hashApiKey } from "../src/lib/auth/api-key";

async function main() {
  if (!/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY ?? "")) {
    console.warn(
      "[api-keys] ENCRYPTION_KEY chưa được cấu hình: key sẽ được mã hoá bằng khoá suy ra từ SESSION_SECRET.",
    );
  }

  const rows = await prisma.user.findMany({
    where: { apiKey: { not: null } },
    select: { id: true, apiKey: true },
  });

  let migrated = 0;
  for (const row of rows) {
    if (!row.apiKey) continue;

    try {
      await prisma.user.update({
        where: { id: row.id },
        data: apiKeyColumns(row.apiKey),
      });
      migrated += 1;
      console.log(
        `[api-keys] migrated user ${row.id} (hash ${hashApiKey(row.apiKey).slice(0, 12)}…)`,
      );
    } catch (error) {
      console.error(`[api-keys] failed to migrate user ${row.id}`, error);
    }
  }

  const remaining = await prisma.user.count({
    where: { apiKey: { not: null } },
  });
  console.log(
    JSON.stringify({
      scanned: rows.length,
      migrated,
      remainingPlaintext: remaining,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
