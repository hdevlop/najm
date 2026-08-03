import "reflect-metadata";
import { describe, expect, it } from "bun:test";

import { Err, ValidationError, VALIDATION_CODES } from "../dist/index.mjs";

// ============================================================================
// LOCAL TYPES (mirrors of internal ValidationIssue / ZodErrorLike shapes)
// ============================================================================

interface ValidationIssue {
  path: PropertyKey[];
  message: string;
  code: string;
}

interface ZodErrorLike {
  issues: { path: PropertyKey[]; message: string; code: string }[];
}

// ============================================================================
// HELPERS
// ============================================================================

const makeIssues = (count = 1): ValidationIssue[] =>
  Array.from({ length: count }, (_, i) => ({
    path: [`field${i}`],
    message: `message-${i}`,
    code: "too_small",
  }));

const makeZodError = (
  ...issues: { path: PropertyKey[]; message: string; code: string }[]
): ZodErrorLike => ({ issues });

// ============================================================================
// CORE VALIDATION ERROR SERIALIZATION CONTRACT
// ============================================================================

describe("ValidationError serialization contract", () => {
  it("includes code, message, target, and the complete issues array for a body error", () => {
    const issues: ValidationIssue[] = [
      {
        path: ["cin"],
        message: "CIN must be at least 8 characters",
        code: "too_small",
      },
    ];

    const error = ValidationError.create("body", issues);
    const json = error.toJSON();

    expect(json).toEqual({
      error: "Validation Error",
      code: VALIDATION_CODES.BODY,
      message: "CIN must be at least 8 characters",
      target: "body",
      issues,
    });
  });

  it("uses the first issue message as the top-level message while keeping all issues ordered", () => {
    const issues: ValidationIssue[] = [
      { path: ["cin"], message: "CIN too short", code: "too_small" },
      { path: ["email"], message: "Invalid email", code: "invalid_string" },
      { path: ["age"], message: "Must be a number", code: "invalid_type" },
    ];

    const error = ValidationError.create("body", issues);
    const json = error.toJSON();

    expect(json.message).toBe("CIN too short");
    expect(json.issues).toHaveLength(3);
    expect(json.issues[0].message).toBe("CIN too short");
    expect(json.issues[1].path).toEqual(["email"]);
    expect(json.issues[2].code).toBe("invalid_type");
    // Issues reference is preserved (same array, not copied)
    expect(json.issues).toBe(issues);
  });

  it("exposes the correct stable code for each target", () => {
    const issues = makeIssues(1);

    expect(ValidationError.create("body", issues).toJSON().code).toBe(
      VALIDATION_CODES.BODY,
    );
    expect(ValidationError.create("params", issues).toJSON().code).toBe(
      VALIDATION_CODES.PARAMS,
    );
    expect(ValidationError.create("query", issues).toJSON().code).toBe(
      VALIDATION_CODES.QUERY,
    );
    expect(ValidationError.create("headers", issues).toJSON().code).toBe(
      VALIDATION_CODES.HEADERS,
    );
  });

  it("falls back to the safe target message when the issue list is empty", () => {
    const error = ValidationError.create("query", []);
    const json = error.toJSON();

    expect(json.message).toBe("Validation failed for query");
    expect(json.code).toBe(VALIDATION_CODES.QUERY);
    expect(json.target).toBe("query");
    expect(json.issues).toEqual([]);
  });

  it("preserves status, error, target, and issues for backward compatibility", async () => {
    const issues = makeIssues(2);
    const error = ValidationError.create("body", issues, 422);

    expect(error.status).toBe(422);
    expect(error.code).toBe(VALIDATION_CODES.BODY);

    const json = error.toJSON();
    expect(json.error).toBe("Validation Error");
    expect(json.target).toBe("body");
    expect(json.issues).toBe(issues);
    // New additive fields are present alongside the legacy ones
    expect(json.code).toBe(VALIDATION_CODES.BODY);
    expect(json.message).toBe("message-0");

    const response = error.toResponse();
    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(await response.json()).toEqual(json);
  });

  it("serializes errors built from a Zod-like error via Err.createFromZod", () => {
    const zodError = makeZodError(
      { path: ["password"], message: "Password too short", code: "too_small" },
    );

    const error = Err.createFromZod(zodError, "body");

    const json = error.toJSON();
    expect(json.code).toBe(VALIDATION_CODES.BODY);
    expect(json.message).toBe("Password too short");
    expect(json.target).toBe("body");
    expect(json.issues[0]).toEqual({
      path: ["password"],
      message: "Password too short",
      code: "too_small",
    });
  });
});

// ============================================================================
// SIMPLE CLIENT READS body.message
// ============================================================================

describe("ValidationError simple-client contract", () => {
  it("exposes a top-level message a simple client reads instead of HTTP status text", async () => {
    const issues: ValidationIssue[] = [
      {
        path: ["cin"],
        message: "CIN must be at least 8 characters",
        code: "too_small",
      },
    ];

    const error = ValidationError.create("body", issues);
    const response = error.toResponse();

    expect(response.status).toBe(400);

    // A simple client that reads body.message now gets the friendly field
    // message. Before the contract fix, body.message was undefined and such
    // clients fell back to the HTTP status text ("Bad Request").
    const body = await response.json();
    expect(body.message).toBeDefined();
    expect(body.message).toBe("CIN must be at least 8 characters");
    expect(body.message).not.toBe("");

    // Advanced clients can still map every issues[].path to a form field.
    expect(body.issues[0].path).toEqual(["cin"]);
  });
});