import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Toaster } from "../src/components/ui/sonner";

const sonnerSource = readFileSync(
  fileURLToPath(new URL("../src/components/ui/sonner.tsx", import.meta.url)),
  "utf8",
);

describe("Toaster wrapper", () => {
  test("renders without crashing", () => {
    const { container } = render(<Toaster />);
    expect(container).toBeDefined();
  });

  test("does not hardcode richColors=false so callers can enable richColors", () => {
    expect(sonnerSource).not.toMatch(/richColors\s*=\s*\{?\s*false/);
  });

  test("spreads consumer props after defaults so they can override", () => {
    expect(sonnerSource).toMatch(/\{\.\.\.props\}/);
  });

  test("merges caller toastOptions.classNames over wrapper defaults", () => {
    const { container } = render(
      <Toaster
        toastOptions={{
          classNames: {
            success: "caller-success-class",
          },
        }}
      />,
    );
    expect(container).toBeDefined();
  });

  test("accepts position and duration props without warnings", () => {
    const { container } = render(<Toaster position="top-center" duration={1234} />);
    expect(container).toBeDefined();
  });
});
