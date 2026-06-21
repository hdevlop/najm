import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "najm-kit";
import { useStudio } from "../../app/studio-store";
import { TOKEN_CATEGORIES } from "../../theme/token-meta";
import { ColorTokenControl } from "../ColorTokenControl";

export function ColorsTab() {
  const { activeTokenCategory, setTokenCategory } = useStudio();
  const [openSections, setOpenSections] = useState<string[]>([activeTokenCategory]);

  function toggleSection(id: string) {
    setTokenCategory(id as typeof activeTokenCategory);
    setOpenSections((current) =>
      current.includes(id)
        ? current.filter((section) => section !== id)
        : [...current, id],
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {TOKEN_CATEGORIES.map((category) => (
        <Collapsible
          key={category.id}
          open={openSections.includes(category.id)}
          onOpenChange={() => toggleSection(category.id)}
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={
                activeTokenCategory === category.id
                  ? "inline-flex h-7 w-fit items-center gap-1 rounded-md bg-muted px-2 text-xs font-semibold uppercase tracking-wide text-foreground"
                  : "inline-flex h-7 w-fit items-center gap-1 rounded-md bg-muted/60 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
              }
            >
              <ChevronDown
                className={
                  openSections.includes(category.id)
                    ? "size-3 rotate-180 transition-transform"
                    : "size-3 transition-transform"
                }
              />
              {category.label}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent
            forceMount
            className="overflow-hidden data-[state=closed]:max-h-0 data-[state=open]:max-h-[1200px] data-[state=closed]:opacity-0 data-[state=open]:opacity-100 transition-all"
          >
            <div
              className="pl-2 pt-2"
              onFocusCapture={() => setTokenCategory(category.id)}
            >
              <div className="flex flex-col">
                {category.tokens.map((key) => (
                  <ColorTokenControl key={key} tokenKey={key} />
                ))}
              </div>
              {category.advancedTokens && category.advancedTokens.length > 0 && (
                <details className="group mt-1 border-t border-border pt-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                    <span>Advanced colors</span>
                    <span className="text-[10px] uppercase tracking-normal group-open:hidden">Show</span>
                    <span className="hidden text-[10px] uppercase tracking-normal group-open:inline">Hide</span>
                  </summary>
                  <div className="flex flex-col">
                    {category.advancedTokens.map((key) => (
                      <ColorTokenControl key={key} tokenKey={key} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
