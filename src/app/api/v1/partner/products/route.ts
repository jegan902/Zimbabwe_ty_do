import { NextRequest } from "next/server";
import { handleGetProducts } from "@/lib/services/partner-api.service";

export async function GET(request: NextRequest) {
  return handleGetProducts(request);
}

export async function POST(request: NextRequest) {
  return handleGetProducts(request);
}
