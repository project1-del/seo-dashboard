import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTopQueries } from "@/lib/gsc";

export async function GET(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await auth() as any;
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const siteUrl = searchParams.get("siteUrl");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const country = searchParams.get("country") || "";

  if (!siteUrl || !startDate || !endDate)
    return NextResponse.json({ error: "Missing params" }, { status: 400 });

  try {
    const data = await getTopQueries(session.accessToken, siteUrl, startDate, endDate, country, 100);
    return NextResponse.json({ rows: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
