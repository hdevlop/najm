// Theme
export { NajmThemeProvider } from "./theme/provider";
export type { NajmThemeProviderProps, NajmThemeTokens, NajmMode, NajmAccent, NajmPreset } from "./theme/types";
export { composePreset, resolvePreset } from "./theme/presets/compose";

// Hooks
export { useKeyboard } from "./hooks/useKeyboard";
export { useDelayedLoading } from "./hooks/useDelayedLoading";
export { useClickOutside } from "./hooks/useClickOutside";
export { useDebouncedValue } from "./hooks/useDebouncedValue";
export { useLocalStorageState } from "./hooks/useLocalStorageState";
export { useInfiniteScroll } from "./hooks/useInfiniteScroll";
export { useSelection } from "./hooks/useSelection";

// UI Primitives
export { Button, buttonVariants } from "./components/ui/button";
export { Badge, badgeVariants } from "./components/ui/badge";
export { Input } from "./components/ui/input";
export { Textarea } from "./components/ui/textarea";
export { Label } from "./components/ui/label";
export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent } from "./components/ui/card";
export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from "./components/ui/dialog";
export { Alert, AlertIcon, AlertTitle, AlertDescription, type AlertProps, type AlertVariant } from "./components/ui/alert";
export { Sheet, SheetTrigger, SheetClose, SheetPortal, SheetOverlay, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription } from "./components/ui/sheet";
export { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "./components/ui/dropdown-menu";
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from "./components/ui/popover";
export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue } from "./components/ui/select";
export { NativeSelect, type NativeSelectProps, type NativeSelectOption } from "./components/ui/native-select";
export { Checkbox } from "./components/ui/checkbox";
export { RadioGroup, RadioGroupItem } from "./components/ui/radio-group";
export { Switch } from "./components/ui/switch";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, tooltipContentVariants } from "./components/ui/tooltip";
export { SimpleTooltip, type SimpleTooltipProps } from "./components/ui/simple-tooltip";
export { Progress } from "./components/ui/progress";
export { Separator } from "./components/ui/separator";
export { ScrollArea, type ScrollAreaProps } from "./components/ui/scroll-area";
export { Avatar, AvatarImage, AvatarFallback } from "./components/ui/avatar";
export { Calendar } from "./components/ui/calendar";
export { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut, CommandSeparator } from "./components/ui/command";
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./components/ui/collapsible";
export { Toggle, toggleVariants } from "./components/ui/toggle";
export { IconButton } from "./components/ui/icon-button";
export type { IconButtonProps, IconButtonVariant, IconButtonSize } from "./components/ui/icon-button";
export { SegmentedControl } from "./components/ui/segmented-control";
export type { SegmentedControlProps, SegmentedControlOption } from "./components/ui/segmented-control";
export { StatusPill } from "./components/ui/status-pill";
export type { StatusPillProps, StatusPillTone } from "./components/ui/status-pill";
export { Toaster } from "./components/ui/sonner";
export { Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage, FormField, useFormField } from "./components/ui/form";
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption } from "./components/ui/table";

// Feedback
export { NSpinner } from "./components/feedback/NSpinner";
export type { NSpinnerProps, SpinnerVariant } from "./components/feedback/NSpinner";
export { NLoadingState } from "./components/feedback/NLoadingState";
export type { NLoadingStateProps } from "./components/feedback/NLoadingState";
export { NErrorState } from "./components/feedback/NErrorState";
export type { NErrorStateProps } from "./components/feedback/NErrorState";
export { NEmptyState } from "./components/feedback/NEmptyState";
export type { NEmptyStateProps } from "./components/feedback/NEmptyState";
export { NConfirmDialog } from "./components/feedback/NConfirmDialog";
export type { NConfirmDialogProps } from "./components/feedback/NConfirmDialog";
export { NErrorBoundary } from "./components/feedback/NErrorBoundary";
export { NSkeleton, NStatCardSkeleton, NTableRowSkeleton, NTableSkeleton } from "./components/feedback/NSkeletonPresets";

// Data Display
export { NStatusBadge, getStatusTheme, statusBadgeVariants, STATUS_THEME_MAP, THEME_ICON_MAP, NAsyncCard, NDetailCard, NDetailItem, NDetailList, NStatCard, NAvatarItem, NViewToggle, NFilterBar, NRowActions, NViewBody, NContextMenu, NBulkActionsBar, NUploader, useContextMenu, useStorageContextMenu } from "./components/data-display";
export type { NStatusBadgeProps, StatusTheme, NAsyncCardProps, NAsyncCardClassNames, NDetailCardProps, NDetailCardClassNames, NDetailItemProps, NDetailListItem, NDetailListProps, NStatCardProps, NStatCardClassNames, NStatCardVariant, NAvatarItemProps, NAvatarItemClassNames, NContextMenuProps, NContextMenuItem, NBulkActionsBarProps, NBulkAction, NBulkActionButton, NBulkActionSelect, NUploaderProps, NUploaderItem, NUploaderItemStatus, ContextMenuItem, UseContextMenuResult, StorageTarget, StorageMenuAction, StorageSortOption, UseStorageContextMenuOptions, UseStorageContextMenuResult } from "./components/data-display";
export { NFileTypeIcon, NFolderIcon } from "./components/data-display/NFileTypeIcon";
export type { NFileTypeIconProps, NFolderIconProps } from "./components/data-display/NFileTypeIcon";

// Inputs
export { BaseInput, TextInput, NumberInput, PasswordInput, TextAreaInput, SelectInput, ComboboxInput, MultiSelectInput, RadioGroupInput, CheckboxInput, CheckboxGroupInput, SwitchInput, DateInput, FileInput, ImageInput, StarRatingInput, ColorArrayInput, ColorPickerInput, EmojiInput, LangInput, PhoneInput, TimeInput, getIconColorProps } from "./components/inputs";
export type { TextInputProps, NumberInputProps, PasswordInputProps, TextAreaInputProps, SelectInputProps, ComboboxInputProps, MultiSelectInputProps, RadioGroupInputProps, CheckboxInputProps, CheckboxGroupInputProps, SwitchInputProps, DateInputProps, FileInputProps, ImageInputProps, StarRatingInputProps, ColorArrayInputProps, EmojiInputProps, LangInputProps, PhoneInputProps, TimeInputProps, SelectItemType } from "./components/inputs";
export { Slider, type SliderProps } from "./components/inputs/SliderInput";
export { SearchInput, SearchField } from "./components/inputs/SearchInput";
export { FileImportButton } from "./components/inputs/FileImportButton";

// Combobox — general-purpose dropdown with free-text, inline search, keyboard nav
// ComboboxInput — form-friendly with Popover+Command pattern
export { Combobox, type ComboboxOption, type ComboboxProps } from "./components/ui/combobox";

// Form
export { NForm, FormInput, DynamicArray, PrefixProvider, usePrefix, VariantProvider, useVariant, useVariantPreset, useNForm, MultiStepForm, StepIndicator, StepsHeader, StepsProgress, useStepNavigation, useFormSubmission } from "./components/form";
export type { FormInputProps, FormProps, FormVariant, FormSlotClassNames, UseNFormOptions, StepConfig, MultiStepClassNames, MultiStepFormProps, StepMeta } from "./components/form";

// Table
export { NTable, NTableContent, NTableCards, NTablePagination, NTableHeader, NTableJson, NTableLoadingSkeleton, NDataCardShell, NTableCardRoot, NFileBrowser, buildDefaultFileColumns, formatFileBytes, formatFileRelative, TableStoreContext, useTableStore, createTableStore, useStoreSync, useDynamicPageSize, useTable, useTableKeyboard } from "./components/table";
export type { NTableProps, NTableState, NTableClassNames, TableState, TableStore } from "./components/table";
export type { NDataCardShellProps, NDataCardShellActions } from "./components/table";
export type { NTableCardRootProps, NFileBrowserProps, NFileBrowserCardProps, NFileBrowserRenderThumbProps, FileNode, FileBrowserMode, BuildDefaultFileColumnsOptions } from "./components/table";

// Lib
export { cn } from "./lib/cn";
export type { SelectItemType as SelectItemDataType, DialogSize, DialogWidth, DialogHeight, RenderSlot } from "./lib/types";
export { resolveSlot } from "./lib/slots";

// Dialog
export { NMultiDialog, dialogVariants, NDeleteDialogContent, useDialog, useDialogStore, createDialogStore, NSheet, NPortalScopeProvider, useNPortalScope } from "./components/dialog";
export type { NMultiDialogProps, NDeleteDialogContentProps, NSheetProps, ButtonConfig, DialogConfig, PushDialogOptions, DeleteDialogOptions, DialogApi, DialogStore } from "./components/dialog";
export { NSmartPasteDialog, type NSmartPasteDialogProps, type SmartPastePreview } from "./components/dialog/NSmartPasteDialog";

// Layout
export { NAppShell, NSidebar, NSidebarItem, NNavbar, NCommandPalette, NPageHeader, NInspectorSheet } from "./components/layout";
export type { LinkComponentType, NavItem, UserMenuAction, NAppShellUser, NAppShellAction, NAppShellClassNames, NAppShellProps, NAppCommandItem, NCommandPaletteProps } from "./components/layout";
