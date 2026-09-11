"use client";

import React from "react";
import { normalizeLocationValue } from "./contracts";
import type { NLocationValue } from "./types";

export function useLocationDraft(committed: NLocationValue, open: boolean) {
  const [draft, setDraft] = React.useState(() => normalizeLocationValue(committed));

  React.useEffect(() => {
    if (open) setDraft(normalizeLocationValue(committed));
  }, [committed, open]);

  const discard = React.useCallback(() => setDraft(normalizeLocationValue(committed)), [committed]);
  return { draft, setDraft, discard };
}
