export interface BugReportRequest {
  readonly title: string;
  readonly body: string;
  readonly diagnostics?: Record<string, string>;
}

export function parseBugReportRequest(payload: unknown): BugReportRequest {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Request body must be a JSON object");
  }

  const { title, body, diagnostics } = payload as Record<string, unknown>;

  if (typeof title !== "string" || title.trim().length === 0) {
    throw new Error("`title` is required and must be a non-empty string");
  }

  if (typeof body !== "string" || body.trim().length === 0) {
    throw new Error("`body` is required and must be a non-empty string");
  }

  if (diagnostics !== undefined) {
    if (typeof diagnostics !== "object" || diagnostics === null) {
      throw new Error("`diagnostics` must be an object of string values when present");
    }
    for (const value of Object.values(diagnostics)) {
      if (typeof value !== "string") {
        throw new Error("`diagnostics` values must all be strings");
      }
    }
  }

  return {
    title: title.trim(),
    body: body.trim(),
    ...(diagnostics !== undefined ? { diagnostics: diagnostics as Record<string, string> } : {}),
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    let parsed: BugReportRequest;
    try {
      parsed = parseBugReportRequest(await request.json());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid request body";
      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // GitHub issue creation is not wired up yet — see docs/modules/bug-report-relay.md
    return new Response(
      JSON.stringify({ error: "Not implemented yet", received: { title: parsed.title } }),
      { status: 501, headers: { "content-type": "application/json" } },
    );
  },
};
