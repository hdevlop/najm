export const TAB_COLORS = {
  default: { list: "bg-muted",         active: "bg-background"  },
  primary: { list: "bg-primary/20",    active: "bg-primary/50"  },
  card:    { list: "bg-card",          active: "bg-muted"       },
  ghost:   { list: "bg-transparent",   active: "bg-accent"      },
} as const;

export type NTabsColor = keyof typeof TAB_COLORS;
