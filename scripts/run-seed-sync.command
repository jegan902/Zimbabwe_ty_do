#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
echo "==> Migrating + seeding + mirroring Quang Vinh catalog..."
npm run db:setup
echo ""
echo "==> Product counts:"
node -e "
require('dotenv').config();
const {PrismaClient}=require('@prisma/client');
const {PrismaPg}=require('@prisma/adapter-pg');
const p=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
(async()=>{
  console.log('products', await p.product.count());
  console.log('supplierProducts', await p.supplierProduct.count({where:{isStale:false}}));
  await p.\$disconnect();
})();
"
echo ""
echo "Done. Start app with: npm run dev"
echo "Press Enter to close..."
read -r _
