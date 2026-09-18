import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, waitFor, within } from "@testing-library/react";
import React from "react";
import { NNotifyMenu } from "../../src/components/Notify";
import type { NNotifyItemData, NNotifyLabels } from "../../src/components/Notify";

const ui = () => within(document.body);

const labels: NNotifyLabels = {
  open: "Open notifications",
  unread: (count) => `${count} unread`,
  title: "Notifications",
  loading: "Loading",
  emptyTitle: "All clear",
  emptyDescription: "Nothing to read",
  errorTitle: "Could not load",
  retry: "Retry",
  markRead: "Mark read",
  markingRead: "Marking",
  markAllRead: "Mark all read",
  markingAll: "Marking all",
  view: "View",
  viewAll: "View all",
  unreadState: "Unread",
  justNow: "Just now",
};

const items: NNotifyItemData[] = [
  { id: "a", title: "Contribution validated", body: "Credited.", read: false },
  { id: "b", title: "Order delivered", body: "Delivered.", read: true },
];

describe("NNotifyMenu preset", () => {
  test("renders the whole workflow from data, labels and callbacks", async () => {
    const onMarkRead = mock(async () => {});
    const onMarkAllRead = mock(async () => {});
    const onOpenItem = mock(async (_item: NNotifyItemData) => {});
    const onViewAll = mock(async () => {});

    render(
      <NNotifyMenu
        defaultOpen
        items={items}
        labels={labels}
        locale="en"
        onMarkAllRead={onMarkAllRead}
        onMarkRead={onMarkRead}
        onOpenItem={onOpenItem}
        onViewAll={onViewAll}
        unreadCount={3}
      />,
    );

    expect(ui().getByText("3")).toBeTruthy();
    expect(await ui().findByText(labels.title)).toBeTruthy();
    expect(ui().getByText("Contribution validated")).toBeTruthy();
    expect(ui().getByText("Order delivered")).toBeTruthy();

    fireEvent.click(ui().getByRole("button", { name: labels.markAllRead }));
    await waitFor(() => expect(onMarkAllRead).toHaveBeenCalledTimes(1));

    fireEvent.click(ui().getAllByRole("button", { name: labels.view })[0] as HTMLElement);
    await waitFor(() => expect(onMarkRead).toHaveBeenCalledWith("a"));
    await waitFor(() => expect(onOpenItem).toHaveBeenCalledTimes(1));
    expect(onOpenItem.mock.calls[0]?.[0]).toMatchObject({ id: "a" });
  });

  test("shows the loading, error and empty states in turn", async () => {
    const onRetry = mock(() => {});
    const { rerender } = render(
      <NNotifyMenu defaultOpen items={[]} labels={labels} loading unreadCount={0} />,
    );
    expect(await ui().findByText(labels.loading)).toBeTruthy();

    rerender(
      <NNotifyMenu
        defaultOpen
        error
        items={[]}
        labels={labels}
        onRetry={onRetry}
        unreadCount={0}
      />,
    );
    expect(ui().getByText(labels.errorTitle)).toBeTruthy();
    fireEvent.click(ui().getByRole("button", { name: labels.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<NNotifyMenu defaultOpen items={[]} labels={labels} unreadCount={0} />);
    expect(ui().getByText(labels.emptyTitle)).toBeTruthy();
  });

  test("caps the badge at 99+ and drops it at zero", () => {
    const { rerender } = render(
      <NNotifyMenu items={[]} labels={labels} locale="en" unreadCount={132} />,
    );
    expect(ui().getByText("99+")).toBeTruthy();

    rerender(<NNotifyMenu items={[]} labels={labels} unreadCount={0} />);
    expect(ui().queryByText("99+")).toBeNull();
  });

  test("application pending state disables the matching commands", async () => {
    render(
      <NNotifyMenu
        defaultOpen
        items={items}
        labels={labels}
        markAllPending
        markReadPendingId="a"
        onMarkAllRead={async () => {}}
        onMarkRead={async () => {}}
        unreadCount={1}
      />,
    );

    const markAll = (await ui().findByRole("button", {
      name: labels.markingAll,
    })) as HTMLButtonElement;
    expect(markAll.disabled).toBe(true);
    const markRead = ui().getByRole("button", {
      name: labels.markingRead,
    }) as HTMLButtonElement;
    expect(markRead.disabled).toBe(true);
  });

  test("reports command failures through one handler", async () => {
    const onError = mock((_error: unknown, _action: string) => {});
    render(
      <NNotifyMenu
        defaultOpen
        items={items}
        labels={labels}
        onMarkAllRead={async () => {
          throw new Error("offline");
        }}
        onError={onError}
        unreadCount={1}
      />,
    );

    fireEvent.click(await ui().findByRole("button", { name: labels.markAllRead }));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0]?.[1]).toBe("markAll");
    expect(ui().getByText(labels.title)).toBeTruthy();
  });

  test("renders an application link as the view-all action", async () => {
    const onOpenChange = mock(() => {});
    render(
      <NNotifyMenu
        defaultOpen
        items={items}
        labels={labels}
        onOpenChange={onOpenChange}
        unreadCount={0}
        viewAllLink={<a href="/notifications">{labels.viewAll}</a>}
      />,
    );

    const link = await ui().findByRole("link", { name: labels.viewAll });
    expect(link.getAttribute("href")).toBe("/notifications");
    fireEvent.click(link);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  test("keeps the popover surface safe at 320px", async () => {
    render(<NNotifyMenu defaultOpen items={items} labels={labels} unreadCount={0} />);
    const content = await waitFor(() => {
      const node = document.querySelector("[data-slot=\"notify-content\"]");
      if (!node) throw new Error("no content");
      return node as HTMLElement;
    });
    expect(content.className).toContain("w-[min(24rem,calc(100vw-2rem))]");
    expect(content.className).toContain("max-h-[70vh]");
  });
});
