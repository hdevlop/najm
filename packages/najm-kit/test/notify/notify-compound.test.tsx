import { describe, expect, mock, test } from "bun:test";
import { act, fireEvent, render, waitFor, within } from "@testing-library/react";
import React from "react";
import {
  NNotifyContent,
  NNotifyFooter,
  NNotifyHeader,
  NNotifyItem,
  NNotifyList,
  NNotifyRoot,
  NNotifyTrigger,
  formatNotifyCount,
} from "../../src/components/Notify";
import type { NNotifyItemData, NNotifyLabels } from "../../src/components/Notify";

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

const unreadItem: NNotifyItemData = {
  id: "n1",
  title: "Contribution validated",
  body: "A contribution was credited.",
  href: "/contribution",
  read: false,
};

/**
 * `screen` binds its queries to `document.body` when @testing-library/dom is
 * imported, which happens inside the preload before the happy-dom globals are
 * installed. Binding per call is what works in this package.
 */
const ui = () => within(document.body);

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("NNotifyRoot state", () => {
  test("opens from the trigger when uncontrolled and reports the change", async () => {
    const onOpenChange = mock(() => {});
    render(
      <NNotifyRoot onOpenChange={onOpenChange}>
        <NNotifyTrigger label={labels.open} unreadCount={0} />
        <NNotifyContent>
          <p>preview</p>
        </NNotifyContent>
      </NNotifyRoot>,
    );

    expect(ui().queryByText("preview")).toBeNull();
    fireEvent.click(ui().getByRole("button", { name: labels.open }));

    await waitFor(() => expect(ui().getByText("preview")).toBeTruthy());
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  test("defaultOpen mounts the content without a click", async () => {
    render(
      <NNotifyRoot defaultOpen>
        <NNotifyTrigger label={labels.open} />
        <NNotifyContent>
          <p>preview</p>
        </NNotifyContent>
      </NNotifyRoot>,
    );
    await waitFor(() => expect(ui().getByText("preview")).toBeTruthy());
  });

  test("controlled open never keeps a competing internal state", () => {
    const onOpenChange = mock(() => {});
    render(
      <NNotifyRoot onOpenChange={onOpenChange} open={false}>
        <NNotifyTrigger label={labels.open} />
        <NNotifyContent>
          <p>preview</p>
        </NNotifyContent>
      </NNotifyRoot>,
    );

    fireEvent.click(ui().getByRole("button", { name: labels.open }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(ui().queryByText("preview")).toBeNull();
  });

  test("a compound child outside the root fails with a package error", () => {
    const consoleError = console.error;
    console.error = () => {};
    try {
      expect(() => render(<NNotifyTrigger label={labels.open} />)).toThrow(
        /NNotifyTrigger must be rendered inside/,
      );
      expect(() =>
        render(
          <NNotifyContent>
            <p>preview</p>
          </NNotifyContent>,
        ),
      ).toThrow(/NNotifyContent must be rendered inside/);
    } finally {
      console.error = consoleError;
    }
  });
});

describe("NNotifyTrigger count", () => {
  test.each([
    [0, ""],
    [-4, ""],
    [1, "1"],
    [99, "99"],
    [100, "99+"],
    [1000, "99+"],
  ])("formats %p as %p", (count, expected) => {
    expect(formatNotifyCount(count as number, "en")).toBe(expected);
  });

  test("hides the badge at zero and shows it once there is a count", () => {
    const { rerender } = render(
      <NNotifyRoot>
        <NNotifyTrigger
          label={labels.open}
          locale="en"
          unreadCount={0}
          unreadLabel={labels.unread}
        />
      </NNotifyRoot>,
    );
    expect(ui().queryByText("0")).toBeNull();

    rerender(
      <NNotifyRoot>
        <NNotifyTrigger
          label={labels.open}
          locale="en"
          unreadCount={5}
          unreadLabel={labels.unread}
        />
      </NNotifyRoot>,
    );
    expect(ui().getByText("5")).toBeTruthy();
    expect(ui().getByText("5 unread")).toBeTruthy();
  });

  test("announces the count and honors a custom formatter", () => {
    const { container } = render(
      <NNotifyRoot>
        <NNotifyTrigger
          formatCount={(count) => (count > 0 ? `#${count}` : "")}
          label={labels.open}
          unreadCount={7}
          unreadLabel={labels.unread}
        />
      </NNotifyRoot>,
    );
    expect(ui().getByText("#7")).toBeTruthy();
    const live = container.querySelector("[aria-live=\"polite\"]") as HTMLElement;
    expect(live.textContent).toBe("7 unread");
  });

  test("localizes the badge digits, from the document language by default", () => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = "ar";
    try {
      const { rerender } = render(
        <NNotifyRoot>
          <NNotifyTrigger label={labels.open} unreadCount={5} />
        </NNotifyRoot>,
      );
      // Whatever the runtime's Arabic numbering system yields — the contract
      // is that the badge follows the document language, not a fixed glyph.
      expect(ui().getByText(new Intl.NumberFormat("ar").format(5))).toBeTruthy();

      rerender(
        <NNotifyRoot>
          <NNotifyTrigger label={labels.open} locale="en" unreadCount={5} />
        </NNotifyRoot>,
      );
      expect(ui().getByText("5")).toBeTruthy();
    } finally {
      document.documentElement.lang = previous;
    }
  });

  test("forwards its ref to the button and keeps the popover wiring", async () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(
      <NNotifyRoot>
        <NNotifyTrigger
          label={labels.open}
          ref={ref}
          unreadCount={3}
          unreadLabel={labels.unread}
        />
        <NNotifyContent>
          <p>preview</p>
        </NNotifyContent>
      </NNotifyRoot>,
    );

    expect(ref.current?.tagName).toBe("BUTTON");
    expect(ref.current?.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(ref.current as HTMLButtonElement);
    await waitFor(() => expect(ui().getByText("preview")).toBeTruthy());
  });
});

describe("NNotifyContent lazy children", () => {
  test("does not mount connected children until the menu opens", async () => {
    const mounted = mock(() => {});
    function Connected() {
      React.useEffect(() => {
        mounted();
      }, []);
      return <p>connected</p>;
    }

    render(
      <NNotifyRoot>
        <NNotifyTrigger label={labels.open} />
        <NNotifyContent>
          <Connected />
        </NNotifyContent>
      </NNotifyRoot>,
    );

    expect(mounted).not.toHaveBeenCalled();
    fireEvent.click(ui().getByRole("button", { name: labels.open }));
    await waitFor(() => expect(mounted).toHaveBeenCalledTimes(1));
  });

  test("Escape closes the menu and returns focus to the trigger", async () => {
    render(
      <NNotifyRoot>
        <NNotifyTrigger label={labels.open} />
        <NNotifyContent>
          <p>preview</p>
        </NNotifyContent>
      </NNotifyRoot>,
    );
    const trigger = ui().getByRole("button", { name: labels.open });
    fireEvent.click(trigger);
    await waitFor(() => expect(ui().getByText("preview")).toBeTruthy());

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(ui().queryByText("preview")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe("NNotifyHeader mark-all", () => {
  test("disables while pending and restores after rejection without closing", async () => {
    const gate = deferred();
    const onMarkAllRead = mock(() => gate.promise);
    const onError = mock((_error: unknown, _action: string) => {});

    render(
      <NNotifyRoot defaultOpen>
        <NNotifyTrigger label={labels.open} />
        <NNotifyContent>
          <NNotifyHeader
            markAllLabel={labels.markAllRead}
            markingAllLabel={labels.markingAll}
            onError={onError}
            onMarkAllRead={onMarkAllRead}
            title={labels.title}
          />
        </NNotifyContent>
      </NNotifyRoot>,
    );

    const button = await ui().findByRole("button", { name: labels.markAllRead });
    fireEvent.click(button);
    const pending = await ui().findByRole("button", { name: labels.markingAll });
    expect((pending as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(pending);
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);

    await act(async () => {
      gate.reject(new Error("nope"));
      await gate.promise.catch(() => {});
    });

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0]?.[1]).toBe("markAll");
    expect(ui().getByText(labels.title)).toBeTruthy();
    const restored = await ui().findByRole("button", { name: labels.markAllRead });
    expect((restored as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("NNotifyList states", () => {
  test("renders the loading label", () => {
    render(<NNotifyList items={[]} labels={labels} loading />);
    expect(ui().getByText(labels.loading)).toBeTruthy();
  });

  test("renders the error title and retries", () => {
    const onRetry = mock(() => {});
    render(<NNotifyList error items={[]} labels={labels} onRetry={onRetry} />);
    expect(ui().getByText(labels.errorTitle)).toBeTruthy();
    fireEvent.click(ui().getByRole("button", { name: labels.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("a string error replaces the packaged title", () => {
    render(<NNotifyList error="Network down" items={[]} labels={labels} />);
    expect(ui().getByText("Network down")).toBeTruthy();
  });

  test("renders the empty state and then the rows", () => {
    const { rerender } = render(<NNotifyList items={[]} labels={labels} />);
    expect(ui().getByText(labels.emptyTitle)).toBeTruthy();

    rerender(<NNotifyList items={[unreadItem]} labels={labels} />);
    expect(ui().getByText(unreadItem.title)).toBeTruthy();
    expect(ui().getByText(labels.unreadState as string)).toBeTruthy();
  });

  test("renderItem replaces the default row", () => {
    render(
      <NNotifyList
        items={[unreadItem]}
        labels={labels}
        renderItem={(item, helpers) => <p>{`${item.title}:${helpers.pending}`}</p>}
      />,
    );
    expect(ui().getByText("Contribution validated:false")).toBeTruthy();
  });

  test("passes the per-item pending identity through", () => {
    render(
      <NNotifyList
        items={[unreadItem]}
        labels={labels}
        markReadPendingId={unreadItem.id}
        onMarkRead={() => {}}
      />,
    );
    const marking = ui().getByRole("button", { name: labels.markingRead }) as HTMLButtonElement;
    expect(marking.disabled).toBe(true);
  });

  test("keeps a bounded scroll area around a long list", () => {
    const items = Array.from({ length: 40 }, (_, index) => ({
      ...unreadItem,
      id: `n${index}`,
      title: `Row ${index}`,
    }));
    const { container } = render(<NNotifyList items={items} labels={labels} />);
    const list = container.querySelector("[data-slot=\"notify-list\"]") as HTMLElement;
    expect(list.className).toContain("overflow-y-auto");
    expect(ui().getByText("Row 39")).toBeTruthy();
  });
});

describe("NNotifyItem commands", () => {
  test("marks read before opening and then closes the menu", async () => {
    const order: string[] = [];
    const onMarkRead = mock(async () => {
      order.push("markRead");
    });
    const onOpenItem = mock(async () => {
      order.push("open");
    });
    const onOpenChange = mock(() => {});

    render(
      <NNotifyRoot defaultOpen onOpenChange={onOpenChange}>
        <NNotifyTrigger label={labels.open} />
        <NNotifyContent>
          <NNotifyItem
            item={unreadItem}
            labels={labels}
            onMarkRead={onMarkRead}
            onOpenItem={onOpenItem}
          />
        </NNotifyContent>
      </NNotifyRoot>,
    );

    fireEvent.click(await ui().findByRole("button", { name: labels.view }));
    await waitFor(() => expect(order).toEqual(["markRead", "open"]));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  test("a rejected read never opens and never closes", async () => {
    const onMarkRead = mock(async () => {
      throw new Error("offline");
    });
    const onOpenItem = mock(() => {});
    const onError = mock((_error: unknown, _action: string) => {});
    const onOpenChange = mock(() => {});

    render(
      <NNotifyRoot defaultOpen onOpenChange={onOpenChange}>
        <NNotifyTrigger label={labels.open} />
        <NNotifyContent>
          <NNotifyItem
            item={unreadItem}
            labels={labels}
            onError={onError}
            onMarkRead={onMarkRead}
            onOpenItem={onOpenItem}
          />
        </NNotifyContent>
      </NNotifyRoot>,
    );

    fireEvent.click(await ui().findByRole("button", { name: labels.view }));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0]?.[1]).toBe("markRead");
    expect(onOpenItem).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(ui().getByText(unreadItem.title)).toBeTruthy();
    await waitFor(() => {
      const view = ui().getByRole("button", { name: labels.view }) as HTMLButtonElement;
      expect(view.disabled).toBe(false);
    });
  });

  test("a read item opens without a read command", async () => {
    const onMarkRead = mock(() => {});
    const onOpenItem = mock(() => {});
    render(
      <NNotifyItem
        item={{ ...unreadItem, read: true }}
        labels={labels}
        onMarkRead={onMarkRead}
        onOpenItem={onOpenItem}
      />,
    );

    expect(ui().queryByRole("button", { name: labels.markRead })).toBeNull();
    fireEvent.click(ui().getByRole("button", { name: labels.view }));
    await waitFor(() => expect(onOpenItem).toHaveBeenCalledTimes(1));
    expect(onMarkRead).not.toHaveBeenCalled();
  });

  test("the standalone mark-read action reports after the command resolves", async () => {
    const onMarkedRead = mock(() => {});
    const onMarkRead = mock(async () => {});
    render(
      <NNotifyItem
        item={unreadItem}
        labels={labels}
        onMarkRead={onMarkRead}
        onMarkedRead={onMarkedRead}
      />,
    );

    fireEvent.click(ui().getByRole("button", { name: labels.markRead }));
    await waitFor(() => expect(onMarkedRead).toHaveBeenCalledTimes(1));
    expect(onMarkRead).toHaveBeenCalledWith(unreadItem.id);
  });

  test("a repeated click cannot run the command twice", async () => {
    const gate = deferred();
    const onMarkRead = mock(() => gate.promise);
    render(<NNotifyItem item={unreadItem} labels={labels} onMarkRead={onMarkRead} />);

    fireEvent.click(ui().getByRole("button", { name: labels.markRead }));
    const pending = await ui().findByRole("button", { name: labels.markingRead });
    fireEvent.click(pending);
    await act(async () => {
      gate.resolve();
      await gate.promise;
    });
    expect(onMarkRead).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["a lucide-style forwardRef component", React.forwardRef<SVGSVGElement, { className?: string }>(
      function Icon(props, ref) {
        return <svg {...props} data-testid="row-icon" ref={ref} />;
      },
    )],
    ["a plain function component", function Icon({ className }: { className?: string }) {
      return <svg className={className} data-testid="row-icon" />;
    }],
    ["an already-built element", <svg data-testid="row-icon" key="icon" />],
  ])("renders %s as the row icon", (_name, icon) => {
    const { container } = render(
      <NNotifyItem
        item={{ ...unreadItem, icon: icon as NNotifyItemData["icon"] }}
        labels={labels}
      />,
    );
    expect(container.querySelector("[data-testid=\"row-icon\"]")).toBeTruthy();
  });

  test("renders without body, timestamp, icon or commands", () => {
    render(<NNotifyItem item={{ id: "bare", title: "Bare", read: true }} labels={labels} />);
    expect(ui().getByText("Bare")).toBeTruthy();
    expect(ui().queryByRole("button")).toBeNull();
  });

  test("an unparseable timestamp falls back to the just-now label", () => {
    render(
      <NNotifyItem
        item={{ id: "x", title: "X", read: true, createdAt: "not-a-date" }}
        labels={labels}
      />,
    );
    expect(ui().getByText(labels.justNow as string)).toBeTruthy();
  });
});

describe("NNotifyFooter", () => {
  test("closes only after the action resolves", async () => {
    const gate = deferred();
    const onViewAll = mock(() => gate.promise);
    const onOpenChange = mock(() => {});

    render(
      <NNotifyRoot defaultOpen onOpenChange={onOpenChange}>
        <NNotifyTrigger label={labels.open} />
        <NNotifyContent>
          <NNotifyFooter label={labels.viewAll} onViewAll={onViewAll} />
        </NNotifyContent>
      </NNotifyRoot>,
    );

    fireEvent.click(await ui().findByRole("button", { name: labels.viewAll }));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    await act(async () => {
      gate.resolve();
      await gate.promise;
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  test("asChild renders an application link that closes the menu", async () => {
    const onOpenChange = mock(() => {});
    render(
      <NNotifyRoot defaultOpen onOpenChange={onOpenChange}>
        <NNotifyTrigger label={labels.open} />
        <NNotifyContent>
          <NNotifyFooter asChild>
            <a href="/notifications">{labels.viewAll}</a>
          </NNotifyFooter>
        </NNotifyContent>
      </NNotifyRoot>,
    );

    const link = await ui().findByRole("link", { name: labels.viewAll });
    expect(link.getAttribute("href")).toBe("/notifications");
    fireEvent.click(link);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  test("reports a rejected action without closing", async () => {
    const onError = mock((_error: unknown, _action: string) => {});
    const onOpenChange = mock(() => {});
    render(
      <NNotifyRoot defaultOpen onOpenChange={onOpenChange}>
        <NNotifyTrigger label={labels.open} />
        <NNotifyContent>
          <NNotifyFooter
            label={labels.viewAll}
            onError={onError}
            onViewAll={async () => {
              throw new Error("blocked");
            }}
          />
        </NNotifyContent>
      </NNotifyRoot>,
    );

    fireEvent.click(await ui().findByRole("button", { name: labels.viewAll }));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0]?.[1]).toBe("viewAll");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
