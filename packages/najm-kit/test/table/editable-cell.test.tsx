import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";

import { NTable, type NTableColumnDef } from "../../src";

interface EditableRow {
  id: string;
  name: string;
  score: number;
  active: boolean;
  status: "draft" | "done";
  notes: string;
}

const row: EditableRow = {
  id: "1",
  name: "Alice",
  score: 10,
  active: false,
  status: "draft",
  notes: "Initial note",
};

function renderEditableTable(
  columns: NTableColumnDef<EditableRow>[],
  onCellEdit: (currentRow: EditableRow, columnId: string, value: any) => Promise<any>,
) {
  return render(
    <div style={{ height: 600 }}>
      <NTable<EditableRow>
        data={[row]}
        columns={columns}
        onCellEdit={onCellEdit}
        dynamicHeight={false}
        showPagination={false}
        showViewToggle={false}
        showAddButton={false}
        showCheckbox={false}
      />
    </div>,
  );
}

describe("NTable editable cells", () => {
  test("commits a text editor through NTable without a consumer wrapper", async () => {
    const onCellEdit = mock(async (_row: EditableRow, _columnId: string, _value: any) => undefined);
    const columns: NTableColumnDef<EditableRow>[] = [
      {
        accessorKey: "name",
        header: "Name",
        meta: { editable: true, editor: "text" },
      },
    ];
    const { container, getByLabelText } = renderEditableTable(columns, onCellEdit);

    fireEvent.click(container.querySelector("[data-ntable-editable-display]")!);
    const input = getByLabelText("Edit name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Amal" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(onCellEdit).toHaveBeenCalledWith(row, "name", "Amal"));
  });

  test("emits numbers and applies row-derived bounds", async () => {
    const onCellEdit = mock(async () => undefined);
    const columns: NTableColumnDef<EditableRow>[] = [
      {
        accessorKey: "score",
        header: "Score",
        meta: {
          editable: true,
          editor: "number",
          min: 0,
          max: (currentRow) => currentRow.score + 90,
          step: 0.5,
        },
      },
    ];
    const { container, getByLabelText } = renderEditableTable(columns, onCellEdit);

    fireEvent.click(container.querySelector("[data-ntable-editable-display]")!);
    const input = getByLabelText("Edit score") as HTMLInputElement;
    expect(input.type).toBe("number");
    expect(input.min).toBe("0");
    expect(input.max).toBe("100");
    expect(input.step).toBe("0.5");

    fireEvent.change(input, { target: { value: "42.5" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(onCellEdit).toHaveBeenCalledWith(row, "score", 42.5));
  });

  test("keeps an invalid value open and exposes its validation message", async () => {
    const onCellEdit = mock(async () => undefined);
    const columns: NTableColumnDef<EditableRow>[] = [
      {
        accessorKey: "name",
        header: "Name",
        meta: {
          editable: true,
          validate: (value) => value.length < 3 ? "Use at least three characters" : null,
        },
      },
    ];
    const { container, findByRole, getByLabelText } = renderEditableTable(columns, onCellEdit);

    fireEvent.click(container.querySelector("[data-ntable-editable-display]")!);
    const input = getByLabelText("Edit name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "A" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect((await findByRole("alert")).textContent).toBe("Use at least three characters");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(onCellEdit).not.toHaveBeenCalled();
  });

  test("supports checkbox and textarea editors", async () => {
    const onCellEdit = mock(async (_row: EditableRow, _columnId: string, _value: any) => undefined);
    const columns: NTableColumnDef<EditableRow>[] = [
      {
        accessorKey: "active",
        header: "Active",
        meta: { editable: true, editor: "checkbox" },
      },
      {
        accessorKey: "notes",
        header: "Notes",
        meta: { editable: true, editor: "textarea" },
      },
    ];
    const { container, getByLabelText } = renderEditableTable(columns, onCellEdit);

    fireEvent.click(getByLabelText("Edit active"));
    await waitFor(() => expect(onCellEdit).toHaveBeenCalledWith(row, "active", true));

    const displays = container.querySelectorAll("[data-ntable-editable-display]");
    fireEvent.click(displays[0]);
    const textarea = getByLabelText("Edit notes");
    fireEvent.change(textarea, { target: { value: "Updated note" } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });

    await waitFor(() => {
      expect(onCellEdit.mock.calls).toContainEqual([row, "notes", "Updated note"]);
    });
  });

  test("preserves typed select values and row-conditional editability", async () => {
    const onCellEdit = mock(async () => undefined);
    const columns: NTableColumnDef<EditableRow>[] = [
      {
        accessorKey: "status",
        header: "Status",
        meta: {
          editable: (currentRow) => currentRow.id === "1",
          editor: "select",
          options: [
            { value: "draft", label: "Draft" },
            { value: "done", label: "Done" },
          ],
        },
      },
    ];
    const { findByRole, getByLabelText } = renderEditableTable(columns, onCellEdit);

    const trigger = getByLabelText("Edit status");
    await act(async () => {
      fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
    });
    const option = await findByRole("option", { name: "Done" });
    await act(async () => {
      fireEvent.click(option);
    });

    await waitFor(() => expect(onCellEdit).toHaveBeenCalledWith(row, "status", "done"));
  });
});
