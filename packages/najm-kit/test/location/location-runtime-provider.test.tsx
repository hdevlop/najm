import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { NLocationRuntimeProvider } from "../../src/location/runtime";
import { useNLocationProvider } from "../../src/location/provider";

function Probe() {
  const location = useNLocationProvider();
  return (
    <output
      data-provider={location.adapter?.id ?? "disabled"}
      data-latitude={location.defaultCenter.latitude}
      data-longitude={location.defaultCenter.longitude}
      data-zoom={location.defaultZoom}
      data-geocoder={location.geocoder?.id ?? "disabled"}
    />
  );
}

describe("NLocationRuntimeProvider", () => {
  test("provides a disabled serializable configuration without an adapter", () => {
    const view = render(
      <NLocationRuntimeProvider
        config={{
          provider: "disabled",
          defaultCenter: { latitude: 1, longitude: 2 },
          defaultZoom: 7,
        }}
      >
        <Probe />
      </NLocationRuntimeProvider>,
    );

    const probe = view.getByRole("status");
    expect(probe.dataset.provider).toBe("disabled");
    expect(probe.dataset.latitude).toBe("1");
    expect(probe.dataset.longitude).toBe("2");
    expect(probe.dataset.zoom).toBe("7");
  });

  test("selects Leaflet without evaluating the lazy map component", () => {
    const view = render(
      <NLocationRuntimeProvider
        config={{
          provider: "leaflet",
          defaultCenter: { latitude: 33.5731, longitude: -7.5898 },
          defaultZoom: 12,
          leaflet: {
            tileUrl: "https://tiles.example/{z}/{x}/{y}.png",
            attribution: "Example tiles",
          },
        }}
      >
        <Probe />
      </NLocationRuntimeProvider>,
    );

    expect(view.getByRole("status").dataset.provider).toBe("leaflet");
  });

  test("selects Google without evaluating the lazy map component", () => {
    const view = render(
      <NLocationRuntimeProvider
        config={{
          provider: "google",
          defaultCenter: { latitude: 35.7595, longitude: -5.834 },
          defaultZoom: 13,
          google: { apiKey: "browser-key" },
        }}
      >
        <Probe />
      </NLocationRuntimeProvider>,
    );

    expect(view.getByRole("status").dataset.provider).toBe("google");
  });

  test("keeps an explicitly supplied geocoder application-owned", () => {
    const geocoder = { id: "private", async search() { return []; } };
    const view = render(
      <NLocationRuntimeProvider
        config={{
          provider: "disabled",
          defaultCenter: { latitude: 1, longitude: 2 },
          defaultZoom: 7,
        }}
        geocoder={geocoder}
      >
        <Probe />
      </NLocationRuntimeProvider>,
    );

    expect(view.getByRole("status").dataset.geocoder).toBe("private");
  });
});
