import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listProperties } from "@/lib/gsc";

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await auth() as any;
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const properties = await listProperties(session.accessToken);
    return NextResponse.json({ properties });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
