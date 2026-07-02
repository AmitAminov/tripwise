import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enqueueDeepResearch, getJob } from "@/lib/deep-research/queue";

/**
 * POST /api/deep-research  { intent: base64url } → { jobId }
 * GET  /api/deep-research?jobId=...              → { status, progress, ... }
 *
 * The spec puts Deep Research on a background job pattern so the
 * request cycle doesn't hold a socket open for 30s+ of provider work.
 * The client can poll GET every ~2s until status === "done".
 */

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  let body: { intent?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const intent = typeof body.intent === "string" ? body.intent : "";
  if (!intent) {
    return NextResponse.json(
      { error: "intent (base64url) required" },
      { status: 400 },
    );
  }

  const job = enqueueDeepResearch(intent);
  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }
  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "unknown job" }, { status: 404 });
  }
  return NextResponse.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    message: job.message,
    result: job.result,
    error: job.error,
  });
}
