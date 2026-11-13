import { NextRequest } from "next/server";
import { handleGetProductDetail } from "@/lib/services/partner-api.service";

export async function GET(request: NextRequest) {
  return handleGetProductDetail(request);
}

export async function POST(request: NextRequest) {
  return handleGetProductDetail(request);
}
