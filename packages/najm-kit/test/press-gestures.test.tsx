import { afterEach, describe, expect, mock, test } from "bun:test";
import React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";

import { NCard } from "../src/components/Card/Card";
import { NTable } from "../src/components/table/NTable";
import { usePressGestures, type PressGestureOptions } from "../src/hooks/usePressGestures";

const wait = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));
const touch = (x = 10, y = 10, pointerId = 1) => ({ pointerType: "touch", pointerId, clientX: x, clientY: y, button: 0 });

function Box({ onClick, ...options }: PressGestureOptions<HTMLDivElement> & { onClick?: () => void }) {
  const { style, ...handlers } = usePressGestures<HTMLDivElement>({ longPressMs: 40, doubleTapMs: 200, haptics: false, ...options });
  return (
    <div data-testid="box" style={style} {...handlers} onClick={onClick}>
      <span data-testid="text">Card</span>
      <button type="button" data-testid="inner-button">Absent</button>
      <input data-testid="inner-input" />
    </div>
  );
}

describe("usePressGestures", () => {
  test("a held touch is a long press, and the click that ends it is swallowed", async () => {
    const onLongPress = mock();
    const onClick = mock();
    const { getByTestId } = render(<Box onLongPress={onLongPress} onClick={onClick} />);
    const text = getByTestId("text");

    fireEvent.pointerDown(text, touch());
    await wait(70);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onLongPress.mock.calls[0][0]).toMatchObject({ pointerType: "touch", clientX: 10, clientY: 10, target: text });

    fireEvent.pointerUp(text, touch());
    fireEvent.click(text);
    expect(onClick).not.toHaveBeenCalled();

    // The next ordinary tap is a click again.
    fireEvent.pointerDown(text, touch());
    fireEvent.pointerUp(text, touch());
    fireEvent.click(text);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("a short tap is not a long press", async () => {
    const onLongPress = mock();
    const { getByTestId } = render(<Box onLongPress={onLongPress} />);
    fireEvent.pointerDown(getByTestId("text"), touch());
    fireEvent.pointerUp(getByTestId("text"), touch());
    await wait(70);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  test("a finger that moves is scrolling, not pressing", async () => {
    const onLongPress = mock();
    const { getByTestId } = render(<Box onLongPress={onLongPress} />);
    fireEvent.pointerDown(getByTestId("text"), touch(10, 10));
    fireEvent.pointerMove(getByTestId("text"), touch(10, 40));
    await wait(70);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  test("the browser taking the touch over cancels the press", async () => {
    const onLongPress = mock();
    const { getByTestId } = render(<Box onLongPress={onLongPress} />);
    fireEvent.pointerDown(getByTestId("text"), touch());
    fireEvent.pointerCancel(getByTestId("text"), touch());
    await wait(70);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  test("Android's own long-press menu is suppressed under a press", () => {
    const onLongPress = mock();
    const { getByTestId } = render(<Box onLongPress={onLongPress} />);
    fireEvent.pointerDown(getByTestId("text"), touch());
    const notCancelled = fireEvent.contextMenu(getByTestId("text"));
    expect(notCancelled).toBe(false);
  });

  test("a mouse right-click keeps its context menu", () => {
    const { getByTestId } = render(<Box onLongPress={mock()} />);
    expect(fireEvent.contextMenu(getByTestId("text"))).toBe(true);
  });

  test("a mouse press is not a long press unless asked", async () => {
    const onLongPress = mock();
    const { getByTestId, rerender } = render(<Box onLongPress={onLongPress} />);
    fireEvent.pointerDown(getByTestId("text"), { ...touch(), pointerType: "mouse" });
    await wait(70);
    expect(onLongPress).not.toHaveBeenCalled();

    rerender(<Box onLongPress={onLongPress} mouseLongPress />);
    fireEvent.pointerDown(getByTestId("text"), { ...touch(), pointerType: "mouse" });
    await wait(70);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  test("two quick taps are a double tap; the first stays a click, the second does not", () => {
    const onDoubleTap = mock();
    const onClick = mock();
    const { getByTestId } = render(<Box onDoubleTap={onDoubleTap} onClick={onClick} />);
    const text = getByTestId("text");

    fireEvent.pointerDown(text, touch(10, 10));
    fireEvent.pointerUp(text, touch(10, 10));
    fireEvent.click(text);
    fireEvent.pointerDown(text, touch(14, 12));
    fireEvent.pointerUp(text, touch(14, 12));
    fireEvent.click(text);

    expect(onDoubleTap).toHaveBeenCalledTimes(1);
    expect(onDoubleTap.mock.calls[0][0]).toMatchObject({ pointerType: "touch" });
    expect(onClick).toHaveBeenCalledTimes(1);

    // The browser's own dblclick after it is not reported a second time.
    fireEvent.doubleClick(text);
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
  });

  test("taps too far apart in time or place are two taps", async () => {
    const onDoubleTap = mock();
    const { getByTestId } = render(<Box onDoubleTap={onDoubleTap} />);
    const text = getByTestId("text");

    fireEvent.pointerDown(text, touch(10, 10));
    fireEvent.pointerUp(text, touch(10, 10));
    fireEvent.pointerDown(text, touch(90, 90));
    fireEvent.pointerUp(text, touch(90, 90));
    expect(onDoubleTap).not.toHaveBeenCalled();

    await wait(250);
    fireEvent.pointerDown(text, touch(90, 90));
    fireEvent.pointerUp(text, touch(90, 90));
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  test("a mouse double-click is a double tap", () => {
    const onDoubleTap = mock();
    const { getByTestId } = render(<Box onDoubleTap={onDoubleTap} />);
    fireEvent.doubleClick(getByTestId("text"), { clientX: 5, clientY: 6 });
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
    expect(onDoubleTap.mock.calls[0][0]).toMatchObject({ pointerType: "mouse", clientX: 5, clientY: 6 });
  });

  test("buttons and fields inside keep their own press", async () => {
    const onLongPress = mock();
    const onDoubleTap = mock();
    const { getByTestId } = render(<Box onLongPress={onLongPress} onDoubleTap={onDoubleTap} />);
    for (const id of ["inner-button", "inner-input"]) {
      fireEvent.pointerDown(getByTestId(id), touch());
      await wait(70);
      fireEvent.pointerUp(getByTestId(id), touch());
      fireEvent.doubleClick(getByTestId(id));
    }
    expect(onLongPress).not.toHaveBeenCalled();
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  test("the element is styled for the gestures it uses, and left alone without them", () => {
    const { getByTestId, rerender } = render(<Box onLongPress={mock()} onDoubleTap={mock()} />);
    const box = getByTestId("box");
    expect(box.style.userSelect).toBe("none");
    expect(box.style.touchAction).toBe("manipulation");

    rerender(<Box />);
    expect(getByTestId("box").style.userSelect).toBe("");
    expect(getByTestId("box").style.touchAction).toBe("");
  });

  test("disabled reads nothing", async () => {
    const onLongPress = mock();
    const { getByTestId } = render(<Box onLongPress={onLongPress} disabled />);
    fireEvent.pointerDown(getByTestId("text"), touch());
    await wait(70);
    expect(onLongPress).not.toHaveBeenCalled();
  });
});

describe("NCard press gestures", () => {
  test("NCard reports a long press and a double click", async () => {
    const onLongPress = mock();
    const onDoubleClick = mock();
    const onClick = mock();
    const { getByText } = render(
      <NCard onClick={onClick} onLongPress={onLongPress} onDoubleClick={onDoubleClick}><span>Student</span></NCard>,
    );
    const text = getByText("Student");

    fireEvent.pointerDown(text, touch());
    await wait(560);
    fireEvent.pointerUp(text, touch());
    fireEvent.click(text);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();

    fireEvent.doubleClick(text);
    expect(onDoubleClick).toHaveBeenCalledTimes(1);
  });
});

interface Row { id: string; name: string }
const rows: Row[] = [{ id: "1", name: "Alice" }, { id: "2", name: "Bob" }];
const columns: ColumnDef<Row, any>[] = [{ accessorKey: "name", header: "Name" }];

describe("NTable row press gestures", () => {
  const originalMatchMedia = window.matchMedia;
  afterEach(() => {
    Object.defineProperty(window, "matchMedia", { writable: true, configurable: true, value: originalMatchMedia });
  });

  test("a card reports its row on a long press and a double tap", async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true, configurable: true,
      value: (query: string) => ({ matches: true, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }),
    });
    const onRowLongPress = mock();
    const onRowDoubleClick = mock();
    const onRowContextMenu = mock();
    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={rows} columns={columns} getRowId={(r) => r.id} mode="cards"
          renderCard={({ data }: { data: Row }) => <div data-testid={`card-${data.id}`}>{data.name}</div>}
          onRowLongPress={onRowLongPress} onRowDoubleClick={onRowDoubleClick} onRowContextMenu={onRowContextMenu}
          dynamicHeight={false} showPagination={false} showAddButton={false} showCheckbox={false}
        />
      </div>,
    );
    await wait(100);
    const card = container.querySelector("[data-testid=card-2]")!;
    expect(card).toBeTruthy();

    fireEvent.pointerDown(card, touch());
    // Android fires its own menu during the press: the long press owns it.
    fireEvent.contextMenu(card);
    await wait(560);
    fireEvent.pointerUp(card, touch());
    expect(onRowLongPress).toHaveBeenCalledTimes(1);
    expect(onRowLongPress.mock.calls[0][0]).toEqual(rows[1]);
    expect(onRowContextMenu).not.toHaveBeenCalled();

    fireEvent.pointerDown(card, touch());
    fireEvent.pointerUp(card, touch());
    fireEvent.pointerDown(card, touch());
    fireEvent.pointerUp(card, touch());
    expect(onRowDoubleClick).toHaveBeenCalledTimes(1);
    expect(onRowDoubleClick.mock.calls[0][0]).toEqual(rows[1]);
  });

  test("a table row reports its row on a mouse double-click", async () => {
    const onRowDoubleClick = mock();
    const { getByText } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={rows} columns={columns} getRowId={(r) => r.id} mode="table"
          onRowDoubleClick={onRowDoubleClick}
          dynamicHeight={false} showPagination={false} showAddButton={false} showCheckbox={false}
        />
      </div>,
    );
    await wait(100);
    fireEvent.doubleClick(getByText("Alice"));
    expect(onRowDoubleClick).toHaveBeenCalledTimes(1);
    expect(onRowDoubleClick.mock.calls[0][0]).toEqual(rows[0]);
  });
});
