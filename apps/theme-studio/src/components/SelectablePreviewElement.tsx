import type { ReactNode } from "react";
import type { NajmComponentName } from "najm-kit";
import { useStudio } from "../app/studio-store";

export function SelectablePreviewElement({
  component,
  children,
  className,
}: {
  component: NajmComponentName;
  children: ReactNode;
  className?: string;
}) {
  const { selectComponent, openFlyout } = useStudio();

  return (
    <div
      className={`relative cursor-pointer ${className ?? ""}`}
      onClick={(e) => {
        e.stopPropagation();
        selectComponent(component);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        openFlyout(component);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openFlyout(component);
      }}
      title="Click to select · double-click to style"
    >
      {children}
    </div>
  );
}
