import {
  NButton,
  NDialog,
  Popover,
  PopoverTrigger,
  PopoverContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SimpleTooltip,
  NCard,
} from "najm-kit";
import { SelectablePreviewElement } from "../SelectablePreviewElement";

export function OverlayPreview() {
  return (
    <NCard title="Overlays" description="Verify these inherit the scoped theme in both light and dark mode.">
      <div className="flex flex-wrap items-center gap-3">
        <SelectablePreviewElement component="dialog">
          <NDialog
            trigger={<NButton>Open dialog</NButton>}
            title="Confirm action"
            description="This is a themed dialog rendered in the preview scope."
            primaryButton={{ text: "Confirm" }}
            secondaryButton={{ text: "Cancel" }}
          />
        </SelectablePreviewElement>

        <SelectablePreviewElement component="popover">
          <Popover>
            <PopoverTrigger asChild>
              <NButton variant="outline">Popover</NButton>
            </PopoverTrigger>
            <PopoverContent>
              <p className="text-sm">Popover content inherits popover tokens.</p>
            </PopoverContent>
          </Popover>
        </SelectablePreviewElement>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <NButton variant="secondary">Menu</NButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <SelectablePreviewElement component="select">
          <Select defaultValue="opt1">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="opt1">Option 1</SelectItem>
              <SelectItem value="opt2">Option 2</SelectItem>
              <SelectItem value="opt3">Option 3</SelectItem>
            </SelectContent>
          </Select>
        </SelectablePreviewElement>

        <SelectablePreviewElement component="tooltip">
          <SimpleTooltip content="A themed tooltip">
            <NButton variant="ghost">Hover me</NButton>
          </SimpleTooltip>
        </SelectablePreviewElement>
      </div>
    </NCard>
  );
}
