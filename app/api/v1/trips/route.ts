import { NextResponse } from "next/server";
import { getJourneyCatalogue } from "@/lib/recovery/core";

export async function GET() {
  return NextResponse.json({ simulated: true, journeys: getJourneyCatalogue() });
}
