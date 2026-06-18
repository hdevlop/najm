import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";

import { NajmDesignProvider } from "../../src/theme/design-provider";
import { NPageLayout } from "../../src/components/layout/NPageLayout";

describe("NPageLayout", () => {
  test("applies layout values from NajmDesignProvider config", () => {
    const { getByTestId } = render(
      <NajmDesignProvider
        config={{
          version: 1,
          theme: {},
          layout: {
            pageGutter: "32px",
            sectionGap: "18px",
          },
        }}
      >
        <NPageLayout data-testid="layout" />
      </NajmDesignProvider>,
    );

    const layout = getByTestId("layout");
    expect(layout.style.paddingInline).toBe("32px");
    expect(layout.style.paddingBlock).toBe("18px");
    expect(layout.style.gap).toBe("18px");
  });
});
