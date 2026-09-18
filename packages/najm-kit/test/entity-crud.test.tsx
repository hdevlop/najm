import { describe, expect, mock, spyOn, test } from "bun:test";
import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "najm-i18n/react";

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
});
