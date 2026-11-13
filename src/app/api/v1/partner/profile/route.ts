import { NextRequest } from "next/server";
import { handleGetProfile } from "@/lib/services/partner-api.service";

export async function GET(request: NextRequest) {
  return handleGetProfile(request);
}

export async function POST(request: NextRequest) {
  return handleGetProfile(request);
}
