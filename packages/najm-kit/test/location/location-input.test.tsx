import React from "react";
import { describe, expect, test } from "bun:test";
import { fireEvent, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NLocationInput, NLocationProvider, type NLocationMapProps, type NLocationValue } from "../../src/location";

function TestMap({ onChange, onReady, onControlsReady }: NLocationMapProps) {
  React.useEffect(() => {
    onReady?.();
    onControlsReady?.({ zoomIn() {}, zoomOut() {}, recenter() {} });
    return () => onControlsReady?.(null);
  // Stable harness contract: one adapter instance per mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <button type="button" onClick={() => onChange({ latitude: 35.75, longitude: -5.83 })}>Choose test point</button>;
}

function Harness({ onCommit }: { onCommit?: (value: NLocationValue) => void }) {
  const [value, setValue] = React.useState<NLocationValue>({ address: "Tangier test address", latitude: null, longitude: null });
  return (
    <NLocationProvider adapter={{ id: "test", Map: TestMap }}>
      <NLocationInput value={value} onChange={(next) => { setValue(next); onCommit?.(next); }} />
    </NLocationProvider>
  );
}

describe("NLocationInput", () => {
  test("keeps manual address editing available when maps are disabled", async () => {
    let latest: NLocationValue | undefined;
    const user = userEvent.setup();
    function DisabledHarness() {
      const [value, setValue] = React.useState<NLocationValue>({ address: "", latitude: null, longitude: null });
      return <NLocationProvider unavailableReason="Disabled"><NLocationInput value={value} onChange={(next) => { latest = next; setValue(next); }} /></NLocationProvider>;
    }
    const view = render(<DisabledHarness />);
    await user.type(view.getByRole("textbox"), "Manual address");
    expect(latest?.address).toBe("Manual address");
    expect(view.getByRole("button", { name: "Select location on map" }).hasAttribute("disabled")).toBe(true);
  });

  test("discards a draft on Cancel and commits one complete value on Confirm", async () => {
    const commits: NLocationValue[] = [];
    const view = render(<Harness onCommit={(value) => commits.push(value)} />);
    fireEvent.click(view.getByRole("button", { name: "Select location on map" }));
    fireEvent.click(view.getByRole("button", { name: "Choose test point" }));
    fireEvent.click(view.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
    expect(view.getByText("Delivery location not selected")).toBeDefined();
    expect(commits).toHaveLength(0);

    fireEvent.click(view.getByRole("button", { name: "Select location on map" }));
    fireEvent.click(view.getByRole("button", { name: "Choose test point" }));
    fireEvent.click(view.getByRole("button", { name: "Confirm address" }));
    await waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
    expect(commits).toHaveLength(1);
    expect(commits[0]).toEqual({ address: "Tangier test address", latitude: 35.75, longitude: -5.83 });
    expect(view.getByText("Delivery location selected")).toBeDefined();
  });

  test("preserves coordinates and warns after editing a confirmed address", async () => {
    const commits: NLocationValue[] = [];
    const user = userEvent.setup();
    const view = render(<Harness onCommit={(value) => commits.push(value)} />);
    fireEvent.click(view.getByRole("button", { name: "Select location on map" }));
    fireEvent.click(view.getByRole("button", { name: "Choose test point" }));
    fireEvent.click(view.getByRole("button", { name: "Confirm address" }));
    await waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
    await user.clear(view.getByRole("textbox"));
    await user.type(view.getByRole("textbox"), "Changed Tangier address");
    expect(commits.at(-1)).toEqual({ address: "Changed Tangier address", latitude: 35.75, longitude: -5.83 });
    expect(view.getByText("Address changed after the pin was selected")).toBeDefined();
  });

  test("manual address edits preserve coordinates and clear stale provider metadata", async () => {
    const metadata: unknown[] = [];
    const values: NLocationValue[] = [];
    const user = userEvent.setup();
    function MetadataHarness() {
      const [value, setValue] = React.useState<NLocationValue>({
        address: "Provider address",
        latitude: 33.58,
        longitude: -7.62,
      });
      return (
        <NLocationProvider adapter={{ id: "google", Map: TestMap }}>
          <NLocationInput
            value={value}
            providerMeta={{
              provider: "google",
              placeId: "ChIJ-stale",
              address: "Provider address",
              latitude: 33.58,
              longitude: -7.62,
            }}
            onChange={(next) => {
              values.push(next);
              setValue(next);
            }}
            onProviderMetaChange={(next) => metadata.push(next)}
          />
        </NLocationProvider>
      );
    }

    const view = render(<MetadataHarness />);
    await user.clear(view.getByRole("textbox"));
    await user.type(view.getByRole("textbox"), "Manually corrected address");

    expect(metadata.length).toBeGreaterThan(0);
    expect(metadata.every((entry) => entry === null)).toBe(true);
    expect(values.at(-1)).toEqual({
      address: "Manually corrected address",
      latitude: 33.58,
      longitude: -7.62,
    });
    expect(view.getByText("Address changed after the pin was selected")).toBeDefined();
  });

  test("tracks a controlled pin supplied after the field mounts", async () => {
    const user = userEvent.setup();
    function ControlledHarness() {
      const [value, setValue] = React.useState<NLocationValue>({ address: "Manual address", latitude: null, longitude: null });
      return (
        <NLocationProvider adapter={{ id: "test", Map: TestMap }}>
          <button type="button" onClick={() => setValue({ address: "Pinned address", latitude: 35, longitude: -5 })}>Load pin</button>
          <NLocationInput value={value} onChange={setValue} />
        </NLocationProvider>
      );
    }

    const view = render(<ControlledHarness />);
    fireEvent.click(view.getByRole("button", { name: "Load pin" }));
    await waitFor(() => expect(view.getByText("Delivery location selected")).toBeDefined());
    await user.clear(view.getByRole("textbox"));
    await user.type(view.getByRole("textbox"), "Edited pinned address");
    expect(view.getByText("Address changed after the pin was selected")).toBeDefined();
  });

  test("prevents editing and opening consistently when disabled or read only", () => {
    const value = { address: "Locked address", latitude: null, longitude: null };
    const disabled = render(
      <NLocationProvider adapter={{ id: "test", Map: TestMap }}>
        <NLocationInput value={value} onChange={() => {}} disabled />
      </NLocationProvider>,
    );
    expect(disabled.getByRole("textbox").hasAttribute("disabled")).toBe(true);
    expect(disabled.getByRole("button", { name: "Select location on map" }).hasAttribute("disabled")).toBe(true);
    disabled.unmount();

    const readOnly = render(
      <NLocationProvider adapter={{ id: "test", Map: TestMap }}>
        <NLocationInput value={value} onChange={() => {}} readOnly />
      </NLocationProvider>,
    );
    expect(readOnly.getByRole("textbox").hasAttribute("readonly")).toBe(true);
    expect(readOnly.getByRole("button", { name: "Select location on map" }).hasAttribute("disabled")).toBe(true);
  });
});
