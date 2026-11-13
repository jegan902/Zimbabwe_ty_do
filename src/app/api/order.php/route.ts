import { NextRequest } from "next/server";
import { handleGetOrderDetail } from "@/lib/services/partner-api.service";

export async function GET(request: NextRequest) {
  return handleGetOrderDetail(request);
}

export async function POST(request: NextRequest) {
  return handleGetOrderDetail(request);
}
