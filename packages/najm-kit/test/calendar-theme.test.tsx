import { describe, expect, test } from "bun:test"
import { render } from "@testing-library/react"
import * as React from "react"
import { Calendar } from "../src/components/ui/calendar"
import { NajmThemeProvider } from "../src/theme/provider"

describe("Calendar theme", () => {
  test.each([
    ["dark", "scheme-dark"],
    ["light", "scheme-light"],
  ] as const)("uses the %s color scheme for native caption dropdowns", (mode, expectedClass) => {
    const { getAllByRole } = render(
      <NajmThemeProvider mode={mode}>
        <Calendar captionLayout="dropdown" />
      </NajmThemeProvider>,
    )

    const dropdowns = getAllByRole("combobox")
    expect(dropdowns).toHaveLength(2)
    for (const dropdown of dropdowns) {
      expect(dropdown.className).toContain(expectedClass)
    }
  })

  test("uses pointer cursors for interactive dates and caption dropdowns", () => {
    const { getAllByRole } = render(<Calendar captionLayout="dropdown" />)

    for (const dropdown of getAllByRole("combobox")) {
      expect(dropdown.className).toContain("cursor-pointer")
    }

    const dayButton = getAllByRole("button").find((button) => /^\d+$/.test(button.textContent?.trim() ?? ""))
    expect(dayButton).toBeDefined()
    expect(dayButton!.className).toContain("cursor-pointer")
    expect(dayButton!.className).toContain("disabled:cursor-not-allowed")
  })

  // Tailwind makes svg a block, which dropped each chevron under its month or
  // year; the label is a flex row so the chevron stays beside the text.
  test("keeps each caption dropdown chevron beside its label", () => {
    const { getAllByRole } = render(<Calendar captionLayout="dropdown" />)

    for (const dropdown of getAllByRole("combobox")) {
      const label = dropdown.parentElement!.querySelector("[aria-hidden]") as HTMLElement
      expect(label.querySelector("svg")).toBeTruthy()
      expect(label.className).toContain("inline-flex")
      expect(label.className).toContain("items-center")
    }
  })
})
