// Theme
export { NajmThemeProvider, useNajmAppearance, useNajmThemeMode } from "./theme/provider";
export { NThemeCustomizer } from "./components/ThemeCustomizer";
export {
  NThemePresets,
  NAJM_SAVED_THEME_VALUE,
} from "./components/ThemeCustomizer";
export {
  DEFAULT_THEME_FILE_NAME,
  normalizeThemeFileName,
  parseThemeFile,
  stringifyThemeFile,
} from "./components/ThemeCustomizer";
export type {
  NThemeCustomizerProps,
  NThemeCustomizerTab,
  NThemeCustomizerFontOption,
  NThemeCustomizerLabels,
  NThemePreset,
  NThemePresetsLabels,
  NThemePresetsProps,
  NThemePresetsStatus,
} from "./components/ThemeCustomizer";
export { defineNajmThemeConfig, parseNajmThemeConfig, stringifyNajmThemeConfig } from "./theme/config";
export type { NajmThemeProviderProps, NajmThemeConfig, NajmThemeTokens, NajmMode, NajmAccent, NajmPreset, NajmAppearance } from "./theme/types";
export { composePreset, resolvePreset } from "./theme/presets/compose";
export { NajmDesignProvider, useNajmDesign, useNajmComponentStyle } from "./theme/design-provider";
export type { NajmDesignProviderProps } from "./theme/design-provider";

// Providers — see src/providers. Framework-agnostic on purpose; the Next
// wiring lives in najm-kit/next.
export {
  NajmUIProvider,
  NajmDesignEditorProvider,
  useNajmDesignEditor,
  NajmPreferencesProvider,
  useNajmPreferencesContext,
  useNajmTheme,
  useNajmTimeZone,
  buildPaginationLabels,
  DEFAULT_TIME_ZONE,
  DEFAULT_PAGINATION_KEY_PREFIX,
  EMPTY_DESIGN,
} from "./providers";
export type {
  NajmUIProviderProps,
  NajmDesignEditorValue,
  NajmDesignEditorProviderProps,
  NajmPreferencesProviderProps,
  NajmPreferencesContextValue,
  NajmTranslate,
} from "./providers";
export { defineNajmDesignConfig, parseNajmDesignConfig, stringifyNajmDesignConfig, resolveVariantAlias } from "./theme/design-config";
export { resolveRadiusValue, RADIUS_VALUE_MAP, NAJM_COMPONENT_NAMES } from "./theme/design-types";
export type {
  NajmDesignConfig,
  NajmComponentThemeConfig,
  NajmComponentStyleConfig,
  NajmComponentName,
  NajmVariantStyle,
  NajmSlotStyle,
  NajmDensity,
  NajmResponsiveBreakpoint,
  NajmResponsiveValue,
  NajmComponentRadius,
  NajmTypographyConfig,
  NajmLayoutConfig,
} from "./theme/design-types";
export {
  surfaceBorderClasses,
  sidebarBorderClasses,
  inputBorderClasses,
} from "./theme/borders";
export type { NajmBorderSide } from "./theme/borders";

// Hooks
export { useKeyboard } from "./hooks/useKeyboard";
export { useDelayedLoading } from "./hooks/useDelayedLoading";
export { useClickOutside } from "./hooks/useClickOutside";
export { useDebouncedValue } from "./hooks/useDebouncedValue";
export { useLocalStorageState } from "./hooks/useLocalStorageState";
export { useInfiniteScroll } from "./hooks/useInfiniteScroll";
export { useSelection } from "./hooks/useSelection";

// UI Primitives
export { Button, NButton, buttonVariants } from "./components/Button";
export type { ButtonIcon, ButtonLoaderPosition, ButtonProps, ButtonRounded, ButtonSize, ButtonVariant, NButtonProps } from "./components/Button";
export { Badge, NBadge, badgeColorVariants, badgeVariants } from "./components/Badge";
export type { BadgeColor, BadgeIcon, BadgeLook, BadgeProps, BadgeShape, BadgeSize, BadgeVariant, NBadgeLook, NBadgeProps } from "./components/Badge";
export { NIndicator, Indicator, indicatorVariants } from "./components/Indicator";
export type { IndicatorProps, IndicatorPosition, IndicatorResponsivePosition, IndicatorOverlay, IndicatorSize, IndicatorVertical, IndicatorHorizontal } from "./components/Indicator";
export { Input } from "./components/ui/input";
export { Textarea } from "./components/ui/textarea";
export { Label } from "./components/ui/label";
export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent } from "./components/ui/card";
export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from "./components/Dialog";
export { Alert, NAlert, alertVariants, type AlertProps, type AlertVariant, type AlertTone, type AlertLook, type AlertSize, type AlertOrientation } from "./components/Alert";
export { Sheet, SheetTrigger, SheetClose, SheetPortal, SheetOverlay, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription } from "./components/ui/sheet";
export { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "./components/ui/dropdown-menu";
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from "./components/ui/popover";
export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue } from "./components/ui/select";
export { NativeSelect, type NativeSelectProps, type NativeSelectOption } from "./components/ui/native-select";
export { Checkbox } from "./components/ui/checkbox";
export { RadioGroup, RadioGroupItem } from "./components/ui/radio-group";
export { Switch } from "./components/ui/switch";
export type { SwitchSize, SwitchColor } from "./components/ui/switch";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
export type { TabsProps, TabsListProps, TabsTriggerProps, TabsVariant, TabsOrientation } from "./components/ui/tabs";
export { NTabs, TAB_COLORS, NEditorTabs, getNextEditorTabValue } from "./components/tabs";
export type { NTabsProps, NTabsItem, NTabsClassNames, NTabsStyles, NTabsColor, NEditorTab, NEditorTabsProps } from "./components/tabs";
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, tooltipContentVariants } from "./components/ui/tooltip";
export { SimpleTooltip, type SimpleTooltipProps } from "./components/ui/simple-tooltip";
export { NProgress, Progress } from "./components/Progress";
export type { NProgressProps, ProgressColor, ProgressLabelPosition, ProgressProps, ProgressSize } from "./components/Progress";
export { Separator } from "./components/ui/separator";
export { ScrollArea, type ScrollAreaProps } from "./components/ui/scroll-area";
export { NajmScroll, type NajmScrollProps } from "./components/ui/scroll";
export { NImage, type NImageProps } from "./components/ui/NImage";
export {
  NBrandingProvider,
  NBrandingStateProvider,
  normalizeBranding,
  useNBranding,
  useNBrandingEditor,
  type NBrandingValue,
  type NBrandingPayload,
  type NBrandingInput,
  type NBrandingEditorValue,
  type NBrandingStateProviderProps,
} from "./components/branding";
export { NIcon } from "./components/Icon";
export type { NIconProps, NIconSource } from "./components/Icon";
export { Avatar, AvatarImage, AvatarFallback, AvatarStatus, AvatarGroup, avatarVariants } from "./components/ui/avatar";
export type { AvatarProps, AvatarSize, AvatarShape, AvatarStatusType, AvatarGroupProps } from "./components/ui/avatar";

export { Swap, NSwap, SwapOn, SwapOff, SwapIndeterminate, swapVariants } from "./components/Swap";
export type { SwapProps, NSwapProps, SwapEffect, SwapSize, SwapState } from "./components/Swap";
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
export { Toaster, toast } from "./components/ui/sonner";
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
export { NErrorBoundary } from "./components/feedback/NErrorBoundary";
export { NSkeleton, Skeleton, NStatCardSkeleton, NTableRowSkeleton, NTableSkeleton, NSkeletonChart, NSkeletonDonut, NSkeletonCalendar, NSkeletonEventList, NSkeletonWidget, NSkeletonWidgets } from "./components/feedback/NSkeletonPresets";

// Avatar
export { NAvatar } from "./components/Avatar";
export type { NAvatarProps, NAvatarClassNames, AvatarShape as NAvatarShape } from "./components/Avatar";

// Card
export { NCard, AsyncCard, NAsyncCard, NCardAction, NCardFooter, NCardMedia, NCardSection, NCardInfo, NSectionInfo, NSection, NSectionWithInfo, NSectionHeader, truncateByCharacters, NStatCard, NDonutCard } from "./components/Card";
export type { CardProps as NCardProps, CardClassNames as NCardClassNames, NAsyncCardProps, NAsyncCardClassNames, NCardMediaProps, NCardMediaVariant, NCardMediaPlacement, NCardMediaSize, NCardMediaAspect, NCardSectionProps, NCardInfoProps, NCardDensity, NCardSectionSurface, NSectionInfoProps, NSectionProps, NSectionWithInfoProps, NSectionWithInfoItem, NSectionHeaderProps, NSectionHeaderTitleProps, NSectionHeaderSubtitleProps, NSectionHeaderContentProps, NSectionHeaderActionsProps, NStatCardProps, NStatCardClassNames, NStatCardVariant, NDonutCardProps, NDonutCardClassNames, NDonutCardVariant, NDonutCardLayout, NDonutCardLegendMarker, NDonutCardItem } from "./components/Card";
export { NBarChart, NChartSkeleton, NLineChart, NPieChart, NStatusBreakdown, getNChartColor } from "./components/Chart";
export type { NBarChartProps, NCartesianChartProps, NChartCardProps, NChartDatum, NChartItem, NChartSeries, NChartSize, NChartSkeletonProps, NChartSkeletonVariant, NLineChartProps, NPieChartProps, NStatusBreakdownProps } from "./components/Chart";

// Data Display
export { NDetailCard, NDetailItem, NDetailList, NViewToggle, NFilterBar, NRowActions, NViewBody, NContextMenu, NBulkActionsBar, useContextMenu, useStorageContextMenu } from "./components/data-display";
export type { NDetailCardProps, NDetailCardClassNames, NDetailItemProps, NDetailListItem, NDetailListProps, NContextMenuProps, NContextMenuItem, NBulkActionsBarProps, NBulkAction, NBulkActionButton, NBulkActionSelect, ContextMenuItem, UseContextMenuResult, StorageTarget, StorageMenuAction, StorageSortOption, UseStorageContextMenuOptions, UseStorageContextMenuResult } from "./components/data-display";
export { NFileTypeIcon, NFolderIcon } from "./components/data-display/NFileTypeIcon";
export type { NFileTypeIconProps, NFolderIconProps } from "./components/data-display/NFileTypeIcon";

// Inputs
export { BaseInput, TextInput, NumberInput, PasswordInput, OtpInput, TextAreaInput, SelectInput, ComboboxInput, MultiSelectInput, RadioGroupInput, CheckboxInput, CheckboxGroupInput, SwitchInput, DateInput, FileInput, NUploader, ImageInput, AvatarInput, StarRatingInput, ColorArrayInput, ColorPickerInput, EmojiInput, LangInput, PhoneInput, TimeInput, TimeZoneInput, SliderInput, getIconColorProps } from "./components/inputs";
export type { TextInputProps, NumberInputProps, PasswordInputProps, OtpInputProps, TextAreaInputProps, SelectInputProps, ComboboxInputProps, MultiSelectInputProps, RadioGroupInputProps, CheckboxInputProps, CheckboxGroupInputProps, SwitchInputProps, DateInputProps, FileInputProps, NUploaderProps, NUploaderItem, NUploaderItemStatus, ImageInputProps, ImageInputPreviewError, ImageInputPreviewSource, AvatarInputProps, AvatarInputRadius, StarRatingInputProps, ColorArrayInputProps, EmojiInputProps, LangInputProps, PhoneInputProps, TimeInputProps, TimeZoneInputProps, SliderInputProps, InputIcon, SelectItemType } from "./components/inputs";
export { Slider, type SliderProps } from "./components/inputs/SliderInput";
export { NSlider, sliderVariants } from "./components/Slider";
export type { NSliderProps, SliderVariant, SliderSize, SliderOrientation } from "./components/Slider";
export { SearchInput, SearchField } from "./components/inputs/SearchInput";
export { FileImportButton } from "./components/inputs/FileImportButton";
export { formatColor, parseColor, detectFormat, toPickerHex } from "./components/inputs/color/convert";
export type { ColorFormat } from "./components/inputs/color/convert";
export type { ColorPickerInputProps } from "./components/inputs/types";

// Combobox — general-purpose dropdown with free-text, inline search, keyboard nav
// ComboboxInput — form-friendly with Popover+Command pattern
export { Combobox, type ComboboxOption, type ComboboxProps } from "./components/ui/combobox";

// Form
export { NForm, FormInput, AvatarFormInput, NFormSectionHeader, RepeatingFields, DynamicArray, PrefixProvider, usePrefix, VariantProvider, useVariant, useVariantPreset, useNForm, WizardForm, StepIndicator, StepsHeader, StepsProgress, useStepNavigation, useFormSubmission } from "./components/form";
export type { FormInputBackground, FormInputProps, FormProps, AvatarFormInputProps, NFormSectionHeaderProps, FormVariant, FormSlotClassNames, UseNFormOptions, DynamicArrayProps, RepeatingFieldsProps, StepConfig, WizardClassNames, WizardFormProps, StepMeta } from "./components/form";

// Table
export { NTable, NTableContent, NTableCards, NTablePagination, NTableHeader, NTableJson, NTableLoadingSkeleton, NDataCardShell, NTableCardRoot, NFileBrowser, buildDefaultFileColumns, formatFileBytes, formatFileRelative, TableStoreContext, useTableStore, createTableStore, useStoreSync, useDynamicPageSize, useTable, useTableKeyboard, filterResponsiveColumns, resolveHiddenBelowClass, hiddenBelowClasses, buildPageItems, NTableDefaultsProvider, useNTableDefaults } from "./components/table";
export type { NTableProps, NTableState, NTableClassNames, TableState, TableStore, TableHeaderColor, NTableMenu, NTableMenuProp, NTableColumnDef, NTableColumnMeta, NTableColumnBreakpoint, NTableCardPagination, NTableLoadMorePagination, NTableInfinitePagination, NTablePaginationVariant, NTablePaginationLabels, NTablePageItem, NTableDefaults } from "./components/table";
export type { NDataCardShellProps, NDataCardShellActions } from "./components/table";
export type { NTableCardRootProps, NFileBrowserProps, NFileBrowserCardProps, NFileBrowserRenderThumbProps, FileNode, FileBrowserMode, BuildDefaultFileColumnsOptions } from "./components/table";

// Lib
export { cn } from "./lib/cn";
export type { SelectItemType as SelectItemDataType, DialogSize, DialogWidth, DialogHeight, RenderSlot } from "./lib/types";
export { resolveSlot } from "./lib/slots";

// Dialog
export { NDialog, NDialogDescription, NDialogHeader, NDialogPrimaryButton, NDialogSecondaryButton, NMultiDialog, dialogVariants, NConfirmDialog, NDeleteDialog, NDeleteDialogContent, useDialog, useDialogStore, createDialogStore, NSheet, NPortalScopeProvider, useNPortalScope } from "./components/Dialog";
export type { NDialogActionProps, NDialogDescriptionProps, NDialogDirectProps, NDialogHeaderProps, NDialogProps, NMultiDialogProps, NConfirmDialogProps, NDeleteDialogContentProps, NDeleteDialogProps, NSheetClassNames, NSheetProps, ButtonConfig, DialogActionMode, DialogVariant, DialogConfig, DialogContentProps, DialogPadding, DialogRenderContext, DialogRenderer, PushDialogOptions, DeleteDialogOptions, DialogApi, DialogStore } from "./components/Dialog";
export { NSmartPasteDialog, type NSmartPasteDialogProps, type SmartPastePreview } from "./components/Dialog/NSmartPasteDialog";

// Sidebar sub-components
export { NSidebarHeader } from "./components/sidebar/NSidebarHeader";
export { NSidebarBrand } from "./components/sidebar/NSidebarBrand";
export { NSidebarContent } from "./components/sidebar/NSidebarContent";
export { NSidebarSection } from "./components/sidebar/NSidebarSection";
export { NSidebarFooter } from "./components/sidebar/NSidebarFooter";
export { NSidebarMobile } from "./components/sidebar/NSidebarMobile";
export { NSidebarProvider, useNSidebar } from "./components/sidebar/NSidebarContext";
export type {
  NSidebarHeaderProps,
  NSidebarBrandProps,
  NSidebarContentProps,
  NSidebarSectionProps,
  NSidebarFooterProps,
  NSidebarMobileProps,
  NSidebarContextValue,
} from "./components/sidebar";

// Layout
export { NAppShell, NSidebar, NSidebarItem, NNavbar, NCommandPalette, NPageLayout, NPageHeader, NPageHeaderActions, NPageHeaderCompactActions, NPageHeaderFilters, NPageHeaderTop, NInspectorSheet, NGrid, NGridItem } from "./components/layout";
export type { SidebarLogo, SidebarLogoRender } from "./components/sidebar/types";
export type { SidebarProps, SidebarItemProps, LinkComponentType,   NavItem,
  NavItemGroup,
  NAppShellClassNames,
  SidebarWidth, SidebarWidths, UserMenuAction, NAppShellUser, NAppShellAction, NAppShellProps, NAppCommandItem, NCommandPaletteProps, NPageLayoutProps, NPageHeaderBreakpoint, NPageHeaderProps, NGridProps, NGridItemProps, NGridCols, NGridSpan } from "./components/layout";
