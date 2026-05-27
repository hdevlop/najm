import { createContext, useContext } from "react";
import type { TableStore } from "./store";

export const TableStoreContext = createContext<TableStore | null>(null);

export const useTableStore = { use: {} as any };

const handler = {
  get: (_: any, prop: string) => () => {
    const store = useContext(TableStoreContext);
    if (!store) throw new Error("useTableStore must be used within NTable");
    return store.use[prop]();
  },
};

useTableStore.use = new Proxy({}, handler);
