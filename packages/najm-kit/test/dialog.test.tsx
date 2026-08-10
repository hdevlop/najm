import React from "react";
import { describe, expect, test } from "bun:test";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Button } from "../src/components/Button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  NConfirmDialog,
  NDialog,
  NDialogDescription,
  NDialogHeader,
  NDialogPrimaryButton,
  NDialogSecondaryButton,
} from "../src/components/Dialog";
import { Dialog as LegacyDialog } from "../src/components/ui/dialog";
import { NConfirmDialog as LegacyNConfirmDialog } from "../src/components/Dialog/NConfirmDialog";

describe("NDialog", () => {
  test("keeps Dialog primitives available from folder and legacy shim", () => {
    expect(LegacyDialog).toBe(Dialog);
    expect(DialogContent).toBeDefined();
    expect(DialogTitle).toBeDefined();
  });

  test("keeps NConfirmDialog in Dialog with feedback compatibility", () => {
    expect(NConfirmDialog).toBe(LegacyNConfirmDialog);
  });

  test("renders as an empty global dialog stack mount with no props", () => {
    const { container } = render(<NDialog />);

    expect(container.textContent).toBe("");
  });

  test("can be used directly without useDialog", async () => {
    let saved = false;

    const { getByRole, getByText } = render(
      <NDialog
        trigger={<Button>Open direct dialog</Button>}
        title="Edit profile"
        description="Make changes to your profile here."
        primaryButton={{
          text: "Save changes",
          onClick: () => {
            saved = true;
          },
        }}
        secondaryButton={{ text: "Cancel" }}
        size="sm"
      >
        <p>Profile form content</p>
      </NDialog>
    );

    fireEvent.click(getByText("Open direct dialog"));

    expect(getByRole("dialog")).toBeDefined();
    expect(getByText("Profile form content")).toBeDefined();

    fireEvent.click(getByText("Save changes"));

    await waitFor(() => {
      expect(saved).toBe(true);
    });
  });

  test("renders string icons from dialog button config", () => {
    const { container, getByText } = render(
      <NDialog
        defaultOpen
        title="Archive item"
        primaryButton={{
          text: "Archive",
          icon: "archive",
        }}
      >
        <p>Archive this item?</p>
      </NDialog>
    );

    expect(getByText("Archive")).toBeDefined();
    expect(container.querySelector("button[data-button-type='primary'] svg")).toBeDefined();
  });

  test("renders the window variant with an inline bordered close button", () => {
    const { getByLabelText, getByRole } = render(
      <NDialog
        defaultOpen
        variant="window"
        title="New Sprite"
        showButtons={false}
        headerClassName="custom-window-header"
        titleClassName="custom-window-title"
        closeButtonClassName="custom-window-close"
      >
        <p>Sprite settings</p>
      </NDialog>
    );

    const dialog = getByRole("dialog");
    const header = dialog.querySelector('[data-slot="dialog-header"]');
    const closeButton = getByLabelText("Close");

    expect(dialog.getAttribute("data-variant")).toBe("window");
    expect(header?.className).toContain("bg-secondary");
    expect(header?.className).toContain("custom-window-header");
    expect(header?.querySelector('[data-slot="dialog-title"]')?.className).toContain("custom-window-title");
    expect(closeButton.className).toContain("border");
    expect(closeButton.className).toContain("custom-window-close");
  });

  test("supports standalone declarative header, description, and action slots", () => {
    const { getByRole, getByText } = render(
      <NDialog defaultOpen variant="window">
        <NDialogHeader label="Compound dialog" className="compound-header" />
        <NDialogDescription label="Declarative description" />
        <p>Body content</p>
        <NDialogSecondaryButton label="Back" variant="outline" className="compound-secondary" />
        <NDialogPrimaryButton label="Save" variant="default" className="compound-primary" />
      </NDialog>
    );

    const dialog = getByRole("dialog");
    expect(getByText("Compound dialog")).toBeDefined();
    expect(getByText("Declarative description")).toBeDefined();
    expect(getByText("Body content")).toBeDefined();
    expect(getByText("Back").getAttribute("data-button-type")).toBe("secondary");
    expect(getByText("Save").getAttribute("data-button-type")).toBe("primary");
    expect(getByText("Back").className).toContain("compound-secondary");
    expect(getByText("Save").className).toContain("compound-primary");
    expect(dialog.querySelector('[data-slot="dialog-header"]')?.className).toContain("compound-header");
  });

  test("submits external forms when a button config has a form id", async () => {
    let submitted = false;
    let clicked = false;

    const { getByText } = render(
      <NDialog
        defaultOpen
        title="External form"
        primaryButton={{
          text: "Submit form",
          form: "external-dialog-form",
          onClick: () => {
            clicked = true;
          },
        }}
      >
        <form
          id="external-dialog-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitted = true;
          }}
        >
          <input name="name" defaultValue="Najm" />
        </form>
      </NDialog>
    );

    fireEvent.click(getByText("Submit form"));

    await waitFor(() => {
      expect(submitted).toBe(true);
    });
    expect(clicked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Focus restoration
//
// A confirmation opened from the keyboard and dismissed with Escape has to give
// focus back to the control that opened it. The alternative is not a cosmetic
// difference: focus falls to <body>, and the next Tab restarts from the top of
// the document, so cancelling a dialog costs a keyboard user their place on the
// page. Found by tabbing a production build, where the primitive's own restore
// ran while the opener was still inside the subtree it had made inert — and
// `focus()` on an inert element does nothing at all.
// ---------------------------------------------------------------------------

describe("dialog focus restoration", () => {
  function Harness() {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <button type="button" data-testid="opener" onClick={() => setOpen(true)}>
          Open
        </button>
        <NConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Are you sure?"
          onConfirm={() => setOpen(false)}
        />
      </>
    );
  }

  test("returns focus to the control that opened it", async () => {
    const { getByTestId, queryByText } = render(<Harness />);
    const opener = getByTestId("opener");

    opener.focus();
    fireEvent.click(opener);
    await waitFor(() => expect(queryByText("Are you sure?")).not.toBeNull());

    // Focus is inside the dialog now, which is the state the restore has to
    // unwind. Asserting it makes the test fail loudly if the dialog ever stops
    // taking focus, rather than passing because nothing ever moved.
    expect(document.activeElement).not.toBe(opener);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(queryByText("Are you sure?")).toBeNull());

    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
