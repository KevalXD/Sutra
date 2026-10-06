import { NextResponse } from "next/server";
import { parseScenario } from "@/lib/scenario";
import { recover } from "@/lib/engine";
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(recover(parseScenario(body.scenario)));
}
