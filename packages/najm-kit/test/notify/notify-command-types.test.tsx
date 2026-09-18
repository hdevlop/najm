import { describe, expect, test } from "bun:test";
import { render, within } from "@testing-library/react";
import React from "react";
import { NNotifyMenu } from "../../src/components/Notify";
import { NLanguageMenu } from "../../src/components/GlobalActions";
import type { NNotifyItemData, NNotifyLabels } from "../../src/components/Notify";

const ui = () => within(document.body);

const labels: NNotifyLabels = {
  open: "Open notifications",
  unread: (count) => `${count} unread`,
  title: "Notifications",
  loading: "Loading",
  emptyTitle: "All clear",
  errorTitle: "Could not load",
  retry: "Retry",
  markRead: "Mark read",
  markAllRead: "Mark all read",
  view: "View",
  viewAll: "View all",
};

const items: NNotifyItemData[] = [
  { id: "a", title: "One", read: false },
];

/**
 * The shape React Query hands an application: `mutateAsync` resolves with the
 * mutation's result, and `refetch` with the query's. A command contract of
 * `Promise<void>` would reject every one of these at the type level and push
 * an async wrapper into every consumer, so this is a compile-time regression
 * guard as much as a runtime one.
 */
const mutation = {
  mutateAsync: async (id: string) => ({ id, readAt: "2026-09-18T00:00:00.000Z" }),
};
const listQuery = { refetch: async () => ({ rows: items }) };

describe("command callbacks accept value-resolving promises", () => {
  test("a React-Query-shaped menu compiles and renders", async () => {
    render(
      <NNotifyMenu
        defaultOpen
        items={items}
        labels={labels}
        onMarkAllRead={() => mutation.mutateAsync("all")}
        onMarkRead={(id) => mutation.mutateAsync(id)}
        onOpenItem={(item) => mutation.mutateAsync(item.id)}
        onRetry={() => listQuery.refetch()}
        onViewAll={() => mutation.mutateAsync("view-all")}
        unreadCount={1}
      />,
    );

    expect(await ui().findByText("One")).toBeTruthy();
  });

  test("a language command may resolve with its own result", () => {
    render(
      <NLanguageMenu
        label="Language"
        onChange={(value) => mutation.mutateAsync(value)}
        options={[{ value: "en", label: "English" }]}
        value="en"
      />,
    );

    expect(ui().getByRole("button", { name: "Language" })).toBeTruthy();
  });
});
