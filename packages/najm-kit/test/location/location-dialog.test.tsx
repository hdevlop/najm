import React from "react";
import { describe, expect, test } from "bun:test";
import { fireEvent, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  NLocationDialog,
  NLocationProvider,
  type NLocationCandidate,
  type NLocationMapProps,
  type NLocationProviderSelectionMeta,
  type NLocationValue,
} from "../../src/location";

function TestMap({ value, onChange, onReady, onControlsReady }: NLocationMapProps) {
  React.useEffect(() => {
    onReady?.();
    onControlsReady?.({ zoomIn() {}, zoomOut() {}, recenter() {} });
    return () => onControlsReady?.(null);
  // Stable harness contract: one adapter instance per mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <button type="button" onClick={() => onChange({ latitude: value?.latitude ?? 1, longitude: value?.longitude ?? 2 })}>Map surface</button>;
}

function Harness({ initial, onConfirm }: { initial: NLocationValue; onConfirm: (value: NLocationValue) => void }) {
  const [open, setOpen] = React.useState(true);
  return <NLocationProvider adapter={{ id: "test", Map: TestMap }}><NLocationDialog open={open} value={initial} onOpenChange={setOpen} onConfirm={onConfirm} /></NLocationProvider>;
}

describe("NLocationDialog", () => {
  test("renders above a parent NMultiDialog layer", () => {
    const { baseElement } = render(
      <NLocationProvider adapter={{ id: "test", Map: TestMap }}>
        <NLocationDialog open value={{ address: "", latitude: null, longitude: null }} onOpenChange={() => {}} onConfirm={() => {}} />
      </NLocationProvider>,
    );

    const content = baseElement.querySelector<HTMLElement>(".nlocation-dialog");
    const overlay = baseElement.querySelector<HTMLElement>('[data-slot="dialog-overlay"]');
    expect(content?.style.zIndex).toBe("10020");
    expect(overlay?.className).toContain("!z-[10010]");
  });

  test("hides search when no geocoder is configured", () => {
    const view = render(<Harness initial={{ address: "Address", latitude: null, longitude: null }} onConfirm={() => {}} />);
    expect(view.queryByPlaceholderText("Search by street, city, or postal code")).toBeNull();
  });

  test("clears both coordinates while preserving the draft address", async () => {
    let committed: NLocationValue | undefined;
    const view = render(<Harness initial={{ address: "Pinned address", latitude: 1, longitude: 2 }} onConfirm={(value) => { committed = value; }} />);
    fireEvent.click(view.getByRole("button", { name: "Clear pin" }));
    fireEvent.click(view.getByRole("button", { name: "Confirm address" }));
    await waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
    expect(committed).toEqual({ address: "Pinned address", latitude: null, longitude: null });
  });

  test("moves a selected marker with keyboard without rendering coordinates", () => {
    let committed: NLocationValue | undefined;
    const view = render(<Harness initial={{ address: "Pinned address", latitude: 1, longitude: 2 }} onConfirm={(value) => { committed = value; }} />);
    const map = view.getByRole("application");
    fireEvent.keyDown(map, { key: "ArrowUp" });
    fireEvent.keyDown(map, { key: "ArrowRight", shiftKey: true });
    fireEvent.click(view.getByRole("button", { name: "Confirm address" }));
    expect(committed?.latitude).toBeCloseTo(1.0001);
    expect(committed?.longitude).toBeCloseTo(2.001);
    expect(view.queryByText("1.0001")).toBeNull();
  });

  test("updates the draft address after reverse geocoding a moved pin", async () => {
    let committed: NLocationValue | undefined;
    const geocoder = {
      id: "test-reverse",
      async search() { return []; },
      async reverse() {
        return { id: "reverse-result", label: "Address at the selected place" };
      },
    };
    function ReverseHarness() {
      const [open, setOpen] = React.useState(true);
      return (
        <NLocationProvider adapter={{ id: "test", Map: TestMap }} geocoder={geocoder}>
          <NLocationDialog open={open} value={{ address: "Old address", latitude: null, longitude: null }} onOpenChange={setOpen} onConfirm={(value) => { committed = value; }} />
        </NLocationProvider>
      );
    }
    const view = render(<ReverseHarness />);
    fireEvent.click(view.getByRole("button", { name: "Map surface" }));
    await waitFor(() => expect(view.getByDisplayValue("Address at the selected place")).toBeDefined());
    fireEvent.click(view.getByRole("button", { name: "Confirm address" }));
    expect(committed).toEqual({ address: "Address at the selected place", latitude: 1, longitude: 2 });
  });

  test("searches explicitly and commits a resolved candidate atomically", async () => {
    let committed: NLocationValue | undefined;
    const user = userEvent.setup();
    const geocoder = {
      id: "test-search",
      async search() {
        return [{ id: "one", label: "Resolved address", coordinates: { latitude: 3, longitude: 4 } }];
      },
    };
    function SearchHarness() {
      const [open, setOpen] = React.useState(true);
      return (
        <NLocationProvider adapter={{ id: "test", Map: TestMap }} geocoder={geocoder}>
          <NLocationDialog open={open} value={{ address: "Old address", latitude: null, longitude: null }} onOpenChange={setOpen} onConfirm={(value) => { committed = value; }} />
        </NLocationProvider>
      );
    }
    const view = render(<SearchHarness />);
    const search = view.getByPlaceholderText("Search by street, city, or postal code");
    await user.type(search, "Resolved");
    fireEvent.click(view.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(view.getByRole("option", { name: "Resolved address" })).toBeDefined());
    fireEvent.click(view.getByRole("option", { name: "Resolved address" }));
    fireEvent.click(view.getByRole("button", { name: "Confirm address" }));
    expect(committed).toEqual({ address: "Resolved address", latitude: 3, longitude: 4 });
  });

  test("commits Google provider metadata separately from the common value", async () => {
    let committed: NLocationValue | undefined;
    let meta: NLocationProviderSelectionMeta | null | undefined;
    const user = userEvent.setup();
    const geocoder = {
      id: "google-places",
      async search() {
        return [{
          id: "ChIJ-place-id",
          providerId: "ChIJ-place-id",
          label: "Google resolved address",
          coordinates: { latitude: 33.58, longitude: -7.62 },
        }];
      },
    };
    const view = render(
      <NLocationProvider adapter={{ id: "google", Map: TestMap }} geocoder={geocoder}>
        <NLocationDialog
          open
          value={{ address: "Old address", latitude: null, longitude: null }}
          onOpenChange={() => {}}
          onConfirm={(value, providerMeta) => {
            committed = value;
            meta = providerMeta;
          }}
        />
      </NLocationProvider>,
    );

    await user.type(view.getByPlaceholderText("Search by street, city, or postal code"), "Google");
    fireEvent.click(view.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(view.getByRole("option", { name: "Google resolved address" })).toBeDefined());
    fireEvent.click(view.getByRole("option", { name: "Google resolved address" }));
    fireEvent.click(view.getByRole("button", { name: "Confirm address" }));

    expect(committed).toEqual({ address: "Google resolved address", latitude: 33.58, longitude: -7.62 });
    expect(meta).toEqual({
      provider: "google",
      placeId: "ChIJ-place-id",
      address: "Google resolved address",
      latitude: 33.58,
      longitude: -7.62,
    });
  });

  test("ignores a stale search response after a newer query", async () => {
    const user = userEvent.setup();
    const pending = new Map<string, (results: readonly { id: string; label: string; coordinates: { latitude: number; longitude: number } }[]) => void>();
    const geocoder = {
      id: "stale-search",
      search(query: string) {
        return new Promise<readonly { id: string; label: string; coordinates: { latitude: number; longitude: number } }[]>((resolve) => pending.set(query, resolve));
      },
    };
    const view = render(
      <NLocationProvider adapter={{ id: "test", Map: TestMap }} geocoder={geocoder}>
        <NLocationDialog open value={{ address: "", latitude: null, longitude: null }} onOpenChange={() => {}} onConfirm={() => {}} />
      </NLocationProvider>,
    );
    const search = view.getByPlaceholderText("Search by street, city, or postal code");
    await user.type(search, "first");
    fireEvent.click(view.getByRole("button", { name: "Search" }));
    await user.clear(search);
    await user.type(search, "second");
    fireEvent.click(view.getByRole("button", { name: "Search" }));
    pending.get("second")?.([{ id: "second", label: "Second result", coordinates: { latitude: 2, longitude: 2 } }]);
    await waitFor(() => expect(view.getByRole("option", { name: "Second result" })).toBeDefined());
    pending.get("first")?.([{ id: "first", label: "Stale result", coordinates: { latitude: 1, longitude: 1 } }]);
    await waitFor(() => expect(view.queryByRole("option", { name: "Stale result" })).toBeNull());
  });

  test("resets an aborted search before the dialog is reopened", async () => {
    const user = userEvent.setup();
    const geocoder = { id: "pending-search", search: () => new Promise<readonly NLocationCandidate[]>(() => {}) };
    function ReopenHarness() {
      const [open, setOpen] = React.useState(true);
      return (
        <NLocationProvider adapter={{ id: "test", Map: TestMap }} geocoder={geocoder}>
          <button type="button" onClick={() => setOpen(true)}>Reopen</button>
          <NLocationDialog open={open} value={{ address: "", latitude: null, longitude: null }} onOpenChange={setOpen} onConfirm={() => {}} />
        </NLocationProvider>
      );
    }
    const view = render(<ReopenHarness />);
    await user.type(view.getByPlaceholderText("Search by street, city, or postal code"), "pending");
    fireEvent.click(view.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(view.getByRole("button", { name: "Confirm address" }).hasAttribute("disabled")).toBe(true));
    fireEvent.click(view.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
    fireEvent.click(view.getByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(view.getByRole("button", { name: "Confirm address" }).hasAttribute("disabled")).toBe(false));
  });
});
