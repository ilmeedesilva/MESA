import { describe, expect, it } from "vitest";
import { ApiError, messageFor, serverUnreachableMessage } from "./api";

describe("messageFor", () => {
  it("says the server cannot be reached when the request never got an answer", () => {
    expect(messageFor(new TypeError("Failed to fetch"), "The scan failed")).toBe(
      `The scan failed. ${serverUnreachableMessage}`
    );
    expect(messageFor(new ApiError(502, "<html>Bad Gateway</html>"), "Could not load the scan")).toBe(
      `Could not load the scan. ${serverUnreachableMessage}`
    );
  });

  it("passes a plain server message through, such as a path that is not allowed", () => {
    const detail =
      "Service path is outside the allowed scan roots: /etc. Set MESA_ALLOWED_SCAN_ROOTS to allow other directories.";
    expect(messageFor(new ApiError(400, detail), "The scan failed")).toBe(`The scan failed. ${detail}`);
  });

  it("never shows raw JSON, HTML or stack traces", () => {
    const validation = JSON.stringify({ detail: [{ loc: ["body", "service_paths"], msg: "Field required" }] });
    expect(messageFor(new ApiError(422, validation), "Could not create the project")).toBe(
      "Could not create the project. Some of the details are not valid: Field required. Check them and try again."
    );
    expect(messageFor(new ApiError(500, 'Traceback (most recent call last):\n  File "x.py"'), "The scan failed")).toBe(
      "The scan failed. The MESA server hit an unexpected problem. Check the API logs, then try again."
    );
    expect(messageFor(new ApiError(400, '{"error": "x"}'), "Could not save policies")).toBe(
      "Could not save policies. Please try again."
    );
    expect(messageFor(new Error("TypeError: Cannot read properties of undefined"), "Could not load the scan")).toBe(
      "Could not load the scan. Please try again."
    );
  });

  it("hides a server exception inside a failed scan job", () => {
    expect(messageFor(new Error("The scan failed. ValueError: bad manifest at line 3"), "The scan failed")).toBe(
      "The scan failed. Please try again."
    );
  });

  it("keeps our own plain sentences as they are", () => {
    expect(messageFor(new Error("The scan failed. No services were found."), "x")).toBe(
      "The scan failed. No services were found."
    );
    expect(messageFor("not an error", "Could not load projects")).toBe("Could not load projects. Please try again.");
  });
});
