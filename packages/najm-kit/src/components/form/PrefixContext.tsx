import React, { createContext, useContext } from "react";

const PrefixContext = createContext<string | number | undefined>(undefined);

export const PrefixProvider: React.FC<{ prefix?: string | number; children: React.ReactNode }> = ({ prefix, children }) => (
  <PrefixContext.Provider value={prefix}>{children}</PrefixContext.Provider>
);

export const usePrefix = (): string | number | undefined => useContext(PrefixContext);
