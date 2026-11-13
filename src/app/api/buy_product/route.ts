import { NextRequest } from "next/server";
import { handleBuyProduct } from "@/lib/services/partner-api.service";

export async function POST(request: NextRequest) {
  return handleBuyProduct(request);
}

export async function GET(request: NextRequest) {
  return handleBuyProduct(request);
}
