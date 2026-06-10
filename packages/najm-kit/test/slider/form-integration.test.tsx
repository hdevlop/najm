import { describe, test, expect } from "bun:test";
import { render } from "@testing-library/react";
import { NSlider } from "../../src/components/Slider/Slider";

describe("NSlider form integration", () => {
  test("single mode with name renders one hidden input with value", () => {
    const { container } = render(<NSlider name="price" value={42} />);
    const inputs = container.querySelectorAll('input[type="hidden"]');
    expect(inputs.length).toBe(1);
    expect(inputs[0].getAttribute("name")).toBe("price");
    expect((inputs[0] as HTMLInputElement).value).toBe("42");
  });

  test("range mode with name renders two hidden inputs", () => {
    const { container } = render(<NSlider name="price" value={[20, 80]} />);
    const inputs = container.querySelectorAll('input[type="hidden"]');
    expect(inputs.length).toBe(2);
    expect(inputs[0].getAttribute("name")).toBe("price");
    expect((inputs[0] as HTMLInputElement).value).toBe("20");
    expect(inputs[1].getAttribute("name")).toBe("price-1");
    expect((inputs[1] as HTMLInputElement).value).toBe("80");
  });

  test("no name attribute renders no hidden inputs", () => {
    const { container } = render(<NSlider value={42} />);
    const inputs = container.querySelectorAll('input[type="hidden"]');
    expect(inputs.length).toBe(0);
  });
});
