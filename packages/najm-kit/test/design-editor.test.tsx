import { describe, test, expect } from "bun:test";
import React from "react";
import { render, fireEvent } from "@testing-library/react";

import { NajmUIProvider, useNajmDesignEditor } from "../src/index";
import { useNajmDesign } from "../src/theme/design-provider";
import type { NajmDesignConfig } from "../src/theme/design-types";

function designWith(radius: string): NajmDesignConfig {
  return {
    version: 1,
    theme: { radius },
    components: { button: { radius: "lg" } },
  };
}

const COMMITTED = designWith("md");

/**
 * Drives the editor and reports what the design *context* resolved to, so the
 * assertions cover the thing that matters — the tree below re-rendering — and
 * not just the editor's own state.
 */
function Probe() {
  const editor = useNajmDesignEditor();
  const { components } = useNajmDesign();

  if (!editor) return <span data-testid="editor">none</span>;

  return (
    <div>
      <span data-testid="live">{editor.design.theme.radius}</span>
      <span data-testid="committed">{editor.committed.theme.radius}</span>
      <span data-testid="draft">{editor.draft ? "open" : "closed"}</span>
      <span data-testid="button-radius">{components.button?.radius ?? "—"}</span>
      <button type="button" data-testid="begin" onClick={editor.beginDraft}>
        begin
      </button>
      <button
        type="button"
        data-testid="set"
        onClick={() => editor.setDraft(designWith("full"))}
      >
        set
      </button>
      <button type="button" data-testid="cancel" onClick={editor.cancelDraft}>
        cancel
      </button>
      <button
        type="button"
        data-testid="commit"
        onClick={() => editor.setCommitted(editor.design)}
      >
        commit
      </button>
    </div>
  );
}

function mount(props: Record<string, unknown> = {}) {
  return render(
    <NajmUIProvider initialDesign={COMMITTED} {...props}>
      <Probe />
    </NajmUIProvider>,
  );
}

describe("useNajmDesignEditor", () => {
  test("seeds from initialDesign and starts with no draft", () => {
    const { getByTestId } = mount();

    expect(getByTestId("live").textContent).toBe("md");
    expect(getByTestId("committed").textContent).toBe("md");
    expect(getByTestId("draft").textContent).toBe("closed");
  });

  test("a draft re-renders the design context below the provider", () => {
    const { getByTestId } = mount();

    fireEvent.click(getByTestId("begin"));
    fireEvent.click(getByTestId("set"));

    expect(getByTestId("live").textContent).toBe("full");
    // The committed design is untouched while the draft is open — that is what
    // makes cancel a real undo rather than a second write.
    expect(getByTestId("committed").textContent).toBe("md");
    expect(getByTestId("draft").textContent).toBe("open");
  });

  test("setDraft works without an explicit beginDraft", () => {
    const { getByTestId } = mount();

    fireEvent.click(getByTestId("set"));

    expect(getByTestId("live").textContent).toBe("full");
    expect(getByTestId("draft").textContent).toBe("open");
  });

  test("cancelDraft restores the committed design", () => {
    const { getByTestId } = mount();

    fireEvent.click(getByTestId("begin"));
    fireEvent.click(getByTestId("set"));
    fireEvent.click(getByTestId("cancel"));

    expect(getByTestId("live").textContent).toBe("md");
    expect(getByTestId("draft").textContent).toBe("closed");
  });

  test("setCommitted adopts the design and closes the draft", () => {
    const { getByTestId } = mount();

    fireEvent.click(getByTestId("begin"));
    fireEvent.click(getByTestId("set"));
    fireEvent.click(getByTestId("commit"));

    expect(getByTestId("live").textContent).toBe("full");
    expect(getByTestId("committed").textContent).toBe("full");
    expect(getByTestId("draft").textContent).toBe("closed");
  });

  test("beginDraft is idempotent and does not discard edits", () => {
    const { getByTestId } = mount();

    fireEvent.click(getByTestId("begin"));
    fireEvent.click(getByTestId("set"));
    fireEvent.click(getByTestId("begin"));

    expect(getByTestId("live").textContent).toBe("full");
  });

  test("the draft is a clone, so editing it cannot mutate the committed design", () => {
    const committed = designWith("md");
    const { getByTestId } = render(
      <NajmUIProvider initialDesign={committed}>
        <Probe />
      </NajmUIProvider>,
    );

    fireEvent.click(getByTestId("begin"));
    fireEvent.click(getByTestId("set"));

    expect(committed.theme.radius).toBe("md");
  });

  test("a controlled `design` keeps the application in charge and the commands inert", () => {
    const { getByTestId } = render(
      <NajmUIProvider design={designWith("xs")}>
        <Probe />
      </NajmUIProvider>,
    );

    fireEvent.click(getByTestId("begin"));
    fireEvent.click(getByTestId("set"));

    expect(getByTestId("live").textContent).toBe("xs");
    expect(getByTestId("draft").textContent).toBe("closed");
  });

  test("design still reaches NajmDesignProvider when no editor is driven", () => {
    const { getByTestId } = mount();

    expect(getByTestId("button-radius").textContent).toBe("lg");
  });
});
