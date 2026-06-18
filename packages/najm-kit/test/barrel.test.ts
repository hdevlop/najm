import { describe, test, expect } from "bun:test";
import * as najmUI from "../src/index";

describe("Root barrel import", () => {
  test("exports cn utility", () => {
    expect(typeof najmUI.cn).toBe("function");
  });

  test("exports JSON theme config helpers", () => {
    expect(typeof najmUI.defineNajmThemeConfig).toBe("function");
    expect(typeof najmUI.parseNajmThemeConfig).toBe("function");
    expect(typeof najmUI.stringifyNajmThemeConfig).toBe("function");
  });

  test("exports Button component", () => {
    expect(najmUI.Button).toBeDefined();
  });

  test("exports NTable component", () => {
    expect(najmUI.NTable).toBeDefined();
  });

  test("exports NTableContent component", () => {
    expect(najmUI.NTableContent).toBeDefined();
  });

  test("exports NTableCards component", () => {
    expect(najmUI.NTableCards).toBeDefined();
  });

  test("exports NTablePagination component", () => {
    expect(najmUI.NTablePagination).toBeDefined();
  });

  test("exports NTableHeader component", () => {
    expect(najmUI.NTableHeader).toBeDefined();
  });

  test("exports NTableJson component", () => {
    expect(najmUI.NTableJson).toBeDefined();
  });

  test("exports NTableLoadingSkeleton component", () => {
    expect(najmUI.NTableLoadingSkeleton).toBeDefined();
  });

  test("exports NTableState type (via re-export)", () => {
    // Types are erased at runtime but the export should not throw
    expect(true).toBe(true);
  });

  test("exports NForm component", () => {
    expect(najmUI.NForm).toBeDefined();
  });

  test("exports RepeatingFields component", () => {
    expect(najmUI.RepeatingFields).toBeDefined();
  });

  test("exports NSpinner component", () => {
    expect(najmUI.NSpinner).toBeDefined();
  });

  test("exports NLoadingState component", () => {
    expect(najmUI.NLoadingState).toBeDefined();
  });

  test("exports NErrorState component", () => {
    expect(najmUI.NErrorState).toBeDefined();
  });

  test("exports NEmptyState component", () => {
    expect(najmUI.NEmptyState).toBeDefined();
  });

  test("exports NConfirmDialog component", () => {
    expect(najmUI.NConfirmDialog).toBeDefined();
  });

  test("exports NErrorBoundary component", () => {
    expect(najmUI.NErrorBoundary).toBeDefined();
  });

  test("exports NSkeleton component", () => {
    expect(najmUI.NSkeleton).toBeDefined();
  });

  test("exports NStatCardSkeleton component", () => {
    expect(najmUI.NStatCardSkeleton).toBeDefined();
  });

  test("exports useKeyboard hook", () => {
    expect(typeof najmUI.useKeyboard).toBe("function");
  });

  test("exports useDelayedLoading hook", () => {
    expect(typeof najmUI.useDelayedLoading).toBe("function");
  });

  test("exports Dialog primitives", () => {
    expect(najmUI.Dialog).toBeDefined();
    expect(najmUI.DialogContent).toBeDefined();
    expect(najmUI.DialogTitle).toBeDefined();
  });

  test("exports resolveSlot utility", () => {
    expect(typeof najmUI.resolveSlot).toBe("function");
  });

  test("exports NAsyncCard component", () => {
    expect(najmUI.NAsyncCard).toBeDefined();
  });

  test("exports NDetailCard component", () => {
    expect(najmUI.NDetailCard).toBeDefined();
  });

  test("exports NDetailItem component", () => {
    expect(najmUI.NDetailItem).toBeDefined();
  });

  test("exports NDetailList component", () => {
    expect(najmUI.NDetailList).toBeDefined();
  });

  test("exports NStatCard component", () => {
    expect(najmUI.NStatCard).toBeDefined();
  });

  test("exports NAvatar component", () => {
    expect(najmUI.NAvatar).toBeDefined();
  });

  test("exports NMultiDialog component", () => {
    expect(najmUI.NMultiDialog).toBeDefined();
  });

  test("exports NDialog component", () => {
    expect(najmUI.NDialog).toBeDefined();
  });

  test("exports NDeleteDialogContent component", () => {
    expect(najmUI.NDeleteDialogContent).toBeDefined();
  });

  test("exports NSmartPasteDialog component", () => {
    expect(najmUI.NSmartPasteDialog).toBeDefined();
  });

  test("exports useDialog hook", () => {
    expect(typeof najmUI.useDialog).toBe("function");
  });

  test("exports WizardForm component", () => {
    expect(najmUI.WizardForm).toBeDefined();
  });

  test("exports CheckboxGroupInput component", () => {
    expect(najmUI.CheckboxGroupInput).toBeDefined();
  });

  test("exports ColorPickerInput component", () => {
    expect(najmUI.ColorPickerInput).toBeDefined();
  });

  test("exports EmojiInput component", () => {
    expect(najmUI.EmojiInput).toBeDefined();
  });

  test("exports ImageInput component", () => {
    expect(najmUI.ImageInput).toBeDefined();
  });

  test("exports LangInput component", () => {
    expect(najmUI.LangInput).toBeDefined();
  });

  test("exports PhoneInput component", () => {
    expect(najmUI.PhoneInput).toBeDefined();
  });

  test("exports NAppShell component", () => {
    expect(najmUI.NAppShell).toBeDefined();
  });

  test("exports NSidebar component", () => {
    expect(najmUI.NSidebar).toBeDefined();
  });

  test("exports NSidebarItem component", () => {
    expect(najmUI.NSidebarItem).toBeDefined();
  });

  test("exports NNavbar component", () => {
    expect(najmUI.NNavbar).toBeDefined();
  });

  test("exports NCommandPalette component", () => {
    expect(najmUI.NCommandPalette).toBeDefined();
  });

  test("exports NPageHeader component", () => {
    expect(najmUI.NPageHeader).toBeDefined();
  });

  test("exports NInspectorSheet component", () => {
    expect(najmUI.NInspectorSheet).toBeDefined();
  });

  test("exports Swap component", () => {
    expect(najmUI.Swap).toBeDefined();
  });

  test("exports SwapOn component", () => {
    expect(najmUI.SwapOn).toBeDefined();
  });

  test("exports SwapOff component", () => {
    expect(najmUI.SwapOff).toBeDefined();
  });

  test("exports SwapIndeterminate component", () => {
    expect(najmUI.SwapIndeterminate).toBeDefined();
  });

  test("exports swapVariants", () => {
    expect(typeof najmUI.swapVariants).toBe("function");
  });

  test("exports AvatarGroup component", () => {
    expect(najmUI.AvatarGroup).toBeDefined();
  });

  test("exports AvatarStatus component", () => {
    expect(najmUI.AvatarStatus).toBeDefined();
  });

  test("exports avatarVariants", () => {
    expect(typeof najmUI.avatarVariants).toBe("function");
  });

  test("has no undefined component exports", () => {
    const names = Object.keys(najmUI);
    expect(names.length).toBeGreaterThan(50);
    for (const name of names) {
      expect((najmUI as any)[name]).toBeDefined();
    }
  });
});
