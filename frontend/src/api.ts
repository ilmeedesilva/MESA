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
      throw new Error(job.error_message || "Repository scan failed.");
    }
    await new Promise((resolve) => window.setTimeout(resolve, pollIntervalMs));
  }
  throw new Error("Repository scan is taking longer than expected. Check back later.");
}

export async function readApiErrorDetail(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const payload = await response.json() as { detail?: unknown };
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
  if (!response.ok || !response.body) throw new Error(`API returned ${response.status}`);

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

export function messageFor(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}
