import {
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
          <Dialog>
            <DialogTrigger asChild>
              <Button>Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm action</DialogTitle>
                <DialogDescription>This is a themed dialog rendered in the preview scope.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Confirm</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </SelectablePreviewElement>

        <SelectablePreviewElement component="popover">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Popover</Button>
            </PopoverTrigger>
            <PopoverContent>
              <p className="text-sm">Popover content inherits popover tokens.</p>
            </PopoverContent>
          </Popover>
        </SelectablePreviewElement>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary">Menu</Button>
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
            <Button variant="ghost">Hover me</Button>
          </SimpleTooltip>
        </SelectablePreviewElement>
      </div>
    </NCard>
  );
}
