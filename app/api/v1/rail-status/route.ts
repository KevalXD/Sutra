import { NextResponse } from "next/server";
import { getRailRadarLiveStatus } from "@/lib/integrations/railradar";
import { isTrainNumber, RailStatusError } from "@/lib/integrations/rail-status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorResponse(error: RailStatusError) {
  return NextResponse.json({ error: { code: error.code, message: error.message } }, {
    status: error.status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function GET(request: Request) {
  const trainNumber = new URL(request.url).searchParams.get("trainNumber")?.trim() ?? "";
  if (!isTrainNumber(trainNumber)) return errorResponse(new RailStatusError("INVALID_TRAIN_NUMBER", "Enter a five-digit train number.", 400));
  try {
    const status = await getRailRadarLiveStatus(trainNumber);
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return errorResponse(error instanceof RailStatusError ? error : new RailStatusError("RAIL_STATUS_UNAVAILABLE", "Live status is temporarily unavailable. Please try again later.", 503));
  }
}
