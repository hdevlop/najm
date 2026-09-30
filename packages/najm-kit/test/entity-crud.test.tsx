import { describe, expect, mock, spyOn, test } from "bun:test";
import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "najm-i18n/react";

import { NFeedbackDefaultsProvider } from "../src/components/feedback/feedbackDefaults";
import { toast } from "../src/components/ui/sonner";
import { useEntityCRUD } from "../src/query/useEntityCRUD";

function wrapperFor(queryClient: QueryClient) {
  return function CrudWrapper({ children }: { children: React.ReactNode }) {
    return (
      <I18nProvider
        translations={{
          en: {
            api: { created: "Created from API" },
            widgets: { success: { created: "Created fallback" } },
          },
        }}
        initialLanguage="en"
        updateDocument={false}
      >
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </I18nProvider>
    );
  };
}

describe("entity CRUD compatibility", () => {
  test("unwraps list responses and invalidates every related entity after create", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidate = spyOn(queryClient, "invalidateQueries");
    const successToast = spyOn(toast, "success").mockImplementation(() => "" as never);
    const getAll = mock(async () => ({ data: [{ id: "widget-1" }] }));
    const create = mock(async () => ({
      data: { id: "widget-2" },
      message: "api.created",
      success: true,
    }));

    const hook = renderHook(
      () => {
        const crud = useEntityCRUD(["widgets", "dashboard"], {
          getAll,
          create,
        });
        return { list: crud.useGetAll(), create: crud.useCreate() };
      },
      { wrapper: wrapperFor(queryClient) },
    );

    await waitFor(() =>
      expect(hook.result.current.list.data).toEqual([{ id: "widget-1" }]),
    );

    // Compiles only while the bridge stays as permissive as the untyped hook
    // it replaces — an established consumer annotates nothing at the call site.
    const rows: { id: string }[] = hook.result.current.list.data;
    expect(rows[0]!.id).toBe("widget-1");

    await act(async () => {
      await hook.result.current.create.mutateAsync({ name: "Second" });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["widgets"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["file"] });
    expect(successToast).toHaveBeenCalledWith("Created from API");
    await act(async () => {
      await Promise.resolve();
    });
    hook.unmount();
    queryClient.clear();
  });

  test("toasts the translated failure rather than the raw server message", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const errorToast = spyOn(toast, "error").mockImplementation(() => "" as never);
    const update = mock(async () => {
      throw { response: { data: { message: "api.created" } } };
    });

    const hook = renderHook(
      () => useEntityCRUD("widgets", { update }).useUpdate(),
      { wrapper: wrapperFor(queryClient) },
    );

    await act(async () => {
      await expect(
        hook.result.current.mutateAsync({ id: "widget-1" }),
      ).rejects.toBeDefined();
    });

    expect(errorToast).toHaveBeenCalledWith("Created from API");

    errorToast.mockRestore();
    hook.unmount();
    queryClient.clear();
  });

  async function toastFor(error: unknown, wrapper?: React.ComponentType<{ children: React.ReactNode }>) {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const errorToast = spyOn(toast, "error").mockImplementation(() => "" as never);
    const update = mock(async () => {
      throw error;
    });
    const hook = renderHook(
      () => useEntityCRUD("widgets", { update }).useUpdate(),
      { wrapper: wrapper ?? wrapperFor(queryClient) },
    );
    await act(async () => {
      await expect(
        hook.result.current.mutateAsync({ id: "widget-1" }),
      ).rejects.toBeDefined();
    });
    const shown = errorToast.mock.calls[0]?.[0];
    errorToast.mockRestore();
    hook.unmount();
    queryClient.clear();
    return shown;
  }

  class FetchError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  }

  test("shows the reason a 4xx states, from a fetch or an Axios error", async () => {
    const reason = "Correction conflicts with recorded attendance";
    expect(await toastFor(new FetchError(409, reason))).toBe(reason);
    expect(
      await toastFor({ response: { status: 422, data: { message: reason } } }),
    ).toBe(reason);
  });

  test("reads a guard's bare Forbidden as access denied", async () => {
    expect(await toastFor(new FetchError(403, "Forbidden"))).toBe("Access denied");
    expect(await toastFor(new FetchError(403, "You cannot reset your own access"))).toBe(
      "You cannot reset your own access",
    );
  });

  test("never shows a 5xx or status-less message, which can carry internals", async () => {
    const internals = 'duplicate key value violates unique constraint "users_email"';
    expect(await toastFor(new FetchError(500, internals))).toBe("Something went wrong");
    expect(await toastFor(new Error(internals))).toBe("Something went wrong");
  });

  test("translates the fallbacks through the feedback labels", async () => {
    const queryClient = new QueryClient();
    const translations: Record<string, string> = {
      "common.feedback.errorTitle": "Une erreur est survenue",
      "common.feedback.forbiddenTitle": "Accès refusé",
    };
    const t = (key: string) => translations[key] ?? key;
    const Base = wrapperFor(queryClient);
    const French = ({ children }: { children: React.ReactNode }) => (
      <Base>
        <NFeedbackDefaultsProvider value={{ defaults: {}, t }}>
          {children}
        </NFeedbackDefaultsProvider>
      </Base>
    );
    expect(await toastFor(new FetchError(500, "boom"), French)).toBe("Une erreur est survenue");
    expect(await toastFor(new FetchError(403, "Forbidden"), French)).toBe("Accès refusé");
  });
});
