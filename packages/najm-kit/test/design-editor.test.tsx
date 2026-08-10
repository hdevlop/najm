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

// ---------------------------------------------------------------------------
// The identity guard on setCommitted
//
// `setCommitted` skips a call that would change nothing. That looks like a
// micro-optimisation and is not: without it, any consumer that re-publishes the
// committed design from an effect keyed on this provider's value loops until
// React gives up with "Maximum update depth exceeded". najm-theme's settings
// provider is exactly such a consumer — it mirrors a saved design into the
// runtime — and the loop blanked its entire settings page.
//
// The guard is identity-based and deliberately narrow. Skipping on deep
// equality instead would swallow the command's second job, which is discarding
// the open draft, and "reset restored the design but left my edits on screen"
// is a worse bug than the one being fixed.
// ---------------------------------------------------------------------------

/** A consumer that mirrors an external design in, the way najm-theme does. */
function Mirror({ design }: { design: NajmDesignConfig }) {
  const editor = useNajmDesignEditor();
  const renders = React.useRef(0);
  renders.current += 1;

  React.useEffect(() => {
    editor?.setCommitted(design);
    // `editor` is in the dependency list on purpose: this is the shape of
    // consumer that the guard protects, and the shape that a lint rule pushes
    // people towards writing.
  }, [editor, design]);

  return <span data-testid="renders">{renders.current}</span>;
}

describe("setCommitted identity guard", () => {
  test("a consumer that re-publishes the committed design settles instead of looping", () => {
    const mirrored = designWith("full");

    // Without the guard this throws React's "Maximum update depth exceeded"
    // out of the effect flush that `render` performs inside `act`.
    const { getByTestId } = render(
      <NajmUIProvider initialDesign={COMMITTED}>
        <Mirror design={mirrored} />
        <Probe />
      </NajmUIProvider>,
    );

    expect(getByTestId("committed").textContent).toBe("full");
    // One render to mount, one for the adoption. A handful more would still be
    // correct; dozens would mean the loop merely terminated rather than settled.
    expect(Number(getByTestId("renders").textContent)).toBeLessThan(5);
  });

  test("an equal-but-distinct design is still adopted", () => {
    // The guard compares identity, not contents. A second object carrying the
    // same values is a real write — the application built it, and it is now the
    // committed design.
    function AdoptTwice() {
      const editor = useNajmDesignEditor();
      return (
        <button
          type="button"
          data-testid="adopt"
          onClick={() => editor?.setCommitted(designWith("full"))}
        >
          adopt
        </button>
      );
    }

    const { getByTestId } = render(
      <NajmUIProvider initialDesign={COMMITTED}>
        <AdoptTwice />
        <Probe />
      </NajmUIProvider>,
    );

    fireEvent.click(getByTestId("adopt"));
    fireEvent.click(getByTestId("adopt"));
    expect(getByTestId("committed").textContent).toBe("full");
  });

  test("re-adopting the design already committed still discards an open draft", () => {
    // The case a naive guard breaks. `setCommitted(committed)` changes nothing
    // about the committed design, so a guard that stops at "same design?" would
    // return early — and leave the draft open, which is the opposite of what
    // this command means.
    function ReadoptCommitted() {
      const editor = useNajmDesignEditor();
      return (
        <button
          type="button"
          data-testid="readopt"
          onClick={() => editor && editor.setCommitted(editor.committed)}
        >
          readopt
        </button>
      );
    }

    const { getByTestId } = render(
      <NajmUIProvider initialDesign={COMMITTED}>
        <ReadoptCommitted />
        <Probe />
      </NajmUIProvider>,
    );

    fireEvent.click(getByTestId("begin"));
    fireEvent.click(getByTestId("set"));
    expect(getByTestId("draft").textContent).toBe("open");

    fireEvent.click(getByTestId("readopt"));
    expect(getByTestId("draft").textContent).toBe("closed");
    expect(getByTestId("live").textContent).toBe("md");
  });
});
