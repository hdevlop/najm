import { describe, expect, mock, spyOn, test } from "bun:test";
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { toast } from "../src/components/ui/sonner";
import {
  getEntityCommandErrorMessage,
  useEntityCommand,
} from "../src/query/useEntityCommand";
import { useEntityQuery } from "../src/query/useEntityQuery";

function wrapperFor(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("entity query helpers", () => {
  test("preserves defined initial data and select", async () => {
    const client = new QueryClient();
    const hook = renderHook(
      () =>
        useEntityQuery({
          queryKey: ["count"],
          queryFn: async () => ({ count: 2 }),
          enabled: false,
          initialData: { count: 1 },
          select: (value) => value.count,
        }),
      { wrapper: wrapperFor(client) },
    );

    expect(hook.result.current.data).toBe(1);
    await act(async () => {
      await Promise.resolve();
    });
    hook.unmount();
    client.clear();
  });

  test("awaits all invalidations before the consumer success callback", async () => {
    const client = new QueryClient();
    const order: string[] = [];
    const invalidate = spyOn(client, "invalidateQueries").mockImplementation(async () => {
      await Promise.resolve();
      order.push("invalidated");
    });
    const onSuccess = mock(() => {
      order.push("success");
    });
    const successToast = spyOn(toast, "success").mockImplementation(() => "" as never);

    const hook = renderHook(
      () =>
        useEntityCommand({
          mutationFn: async (value: number) => value + 1,
          invalidate: [["families"], ["budgets"]],
          successMessage: (data) => `Saved ${data}`,
          onSuccess,
        }),
      { wrapper: wrapperFor(client) },
    );

    await act(async () => {
      expect(await hook.result.current.mutateAsync(1)).toBe(2);
    });
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(order).toEqual(["invalidated", "invalidated", "success"]);
    expect(successToast).toHaveBeenCalledWith("Saved 2");
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  test("normalizes common error shapes and permits an application resolver", async () => {
    expect(
      getEntityCommandErrorMessage({
        response: { data: { message: "Access denied" } },
      }),
    ).toBe("Access denied");
    expect(
      getEntityCommandErrorMessage({ body: { error: "Conflict" } }),
    ).toBe("Conflict");

    const client = new QueryClient();
    const errorToast = spyOn(toast, "error").mockImplementation(() => "" as never);
    const hook = renderHook(
      () =>
        useEntityCommand<never, void>({
          mutationFn: async () => {
            throw new Error("private detail");
          },
          errorMessage: "Safe fallback",
          getErrorMessage: (_error, fallback) => fallback ?? "Safe default",
        }),
      { wrapper: wrapperFor(client) },
    );

    await act(async () => {
      await expect(hook.result.current.mutateAsync()).rejects.toThrow(
        "private detail",
      );
    });
    expect(errorToast).toHaveBeenCalledWith("Safe fallback");
  });

  test("an error resolver wins over the normalized server message", async () => {
    const client = new QueryClient();
    const errorToast = spyOn(toast, "error").mockImplementation(() => "" as never);
    const hook = renderHook(
      () =>
        useEntityCommand<never, void, unknown>({
          mutationFn: async () => {
            throw { body: { message: "Order total exceeds the available budget" } };
          },
          errorMessage: (error) =>
            getEntityCommandErrorMessage(error) ===
            "Order total exceeds the available budget"
              ? "Votre budget disponible est insuffisant."
              : "",
        }),
      { wrapper: wrapperFor(client) },
    );

    await act(async () => {
      await expect(hook.result.current.mutateAsync()).rejects.toBeDefined();
    });
    expect(errorToast).toHaveBeenCalledWith(
      "Votre budget disponible est insuffisant.",
    );

    errorToast.mockRestore();
    hook.unmount();
    client.clear();
  });
});
