import type { AIExplainerResponse, PersistedScanResult, ScanJobRecord } from "./types";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, message?: string) {
    super(message ?? `API returned ${status}`);
    this.status = status;
    this.detail = message ?? `API returned ${status}`;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const detail = await readApiErrorDetail(response);
    throw new ApiError(response.status, detail || `API returned ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function pollScanJob(jobId: string): Promise<PersistedScanResult> {
  const pollIntervalMs = 1000;
  const maxAttempts = 300;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const job = await api<ScanJobRecord>(`/api/scan-jobs/${jobId}`);
    if (job.status === "COMPLETED" && job.scan_id) {
      return api<PersistedScanResult>(`/api/scans/${job.scan_id}`);
    }
    if (job.status === "FAILED") {
      throw new Error(job.error_message ? `The scan failed. ${job.error_message}` : "The scan failed.");
    }
    await new Promise((resolve) => window.setTimeout(resolve, pollIntervalMs));
  }
  throw new Error("Repository scan is taking longer than expected. Check back later.");
}

export async function readApiErrorDetail(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as { detail?: unknown };
      if (typeof payload.detail === "string") return payload.detail;
      return JSON.stringify(payload);
    } catch {
      return `API returned ${response.status}`;
    }
  }
  return await response.text();
}

export async function streamAIResponse(
  path: string,
  payload: Record<string, unknown>,
  onDelta: (chunk: string) => void
): Promise<AIExplainerResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok || !response.body) {
    throw new ApiError(response.status, response.ok ? "" : await readApiErrorDetail(response));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload: AIExplainerResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
      const lines = rawEvent.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event:"));
      const dataLine = lines.find((line) => line.startsWith("data:"));
      if (!eventLine || !dataLine) continue;
      const eventName = eventLine.slice(6).trim();
      const data = JSON.parse(dataLine.slice(5).trim()) as Record<string, unknown>;
      if (eventName === "delta" && typeof data.text === "string") {
        onDelta(data.text);
      }
      if (eventName === "done") {
        finalPayload = data as unknown as AIExplainerResponse;
      }
    }
  }

  if (!finalPayload) throw new Error("No final AI response was returned");
  return finalPayload;
}

export const serverUnreachableMessage =
  "MESA can't reach your MESA server. Check that it is running (docker compose up), then try again.";

/** True when a message is raw output (JSON, HTML, a stack trace) rather than a sentence for people. */
function looksTechnical(message: string) {
  const text = message.trim();
  return (
    !text ||
    text.length > 300 ||
    /^[[{<]/.test(text) ||
    /Traceback \(most recent call last\)|\bat \S+ \(.*:\d+:\d+\)|<\/?html|(?:^|\s)\w*(?:Error|Exception):/.test(text)
  );
}

/** A FastAPI validation error body: [{ "loc": [...], "msg": "..." }]. */
function validationMessage(detail: string) {
  try {
    const parsed = JSON.parse(detail) as { detail?: Array<{ msg?: string }> } | Array<{ msg?: string }>;
    const items = Array.isArray(parsed) ? parsed : parsed.detail;
    const first = Array.isArray(items) ? items.find((item) => typeof item?.msg === "string")?.msg : undefined;
    return first ?? null;
  } catch {
    return null;
  }
}

/**
 * A plain message for something that failed: what failed (the action), then why and what to do
 * next. Never shows stack traces, HTML or raw JSON.
 */
export function messageFor(caught: unknown, action: string) {
  const what = action.replace(/[.\s]+$/, "");
  // fetch() rejects with a TypeError when the server cannot be reached at all.
  if (caught instanceof TypeError) return `${what}. ${serverUnreachableMessage}`;
  if (caught instanceof ApiError) {
    // The web server answers 502/503/504 when the API behind it is down.
    if ([502, 503, 504].includes(caught.status)) return `${what}. ${serverUnreachableMessage}`;
    if (caught.status === 422) {
      const reason = validationMessage(caught.detail);
      return `${what}. Some of the details are not valid${reason ? `: ${reason}` : ""}. Check them and try again.`;
    }
    if (caught.status >= 500)
      return `${what}. The MESA server hit an unexpected problem. Check the API logs, then try again.`;
    if (caught.status === 404 && looksTechnical(caught.detail))
      return `${what}. It was not found; it may have been deleted.`;
    if (looksTechnical(caught.detail)) return `${what}. Please try again.`;
    return `${what}. ${caught.detail}`;
  }
  if (caught instanceof Error && !looksTechnical(caught.message)) {
    // Our own messages are already full sentences.
    return caught.message;
  }
  return `${what}. Please try again.`;
}
