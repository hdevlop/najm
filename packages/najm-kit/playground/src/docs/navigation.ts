export interface NavItem {
  slug: string;
  label: string;
  badge?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    title: 'Getting Started',
    items: [
      { slug: 'introduction', label: 'Introduction' },
      { slug: 'installation', label: 'Installation' },
      { slug: 'theming', label: 'Theming' },
      { slug: 'theme-json-dashboard', label: 'JSON Theme Dashboard', badge: 'New' },
    ],
  },
  {
    title: 'Actions',
    items: [
      { slug: 'button', label: 'Button' },
      { slug: 'toggle', label: 'Toggle' },
      { slug: 'swap', label: 'Swap' },
    ],
  },
  {
    title: 'Data Display',
    items: [
      { slug: 'badge', label: 'Badge' },
      { slug: 'indicator', label: 'Indicator' },
      { slug: 'alert', label: 'Alert' },
      { slug: 'navatar', label: 'Avatar' },
      { slug: 'card', label: 'Card' },
      { slug: 'stat-card', label: 'Stat Card' },
      { slug: 'progress', label: 'Progress' },
      { slug: 'tabs', label: 'Tabs' },
      { slug: 'separator', label: 'Separator' },

      { slug: 'table', label: 'Table' },
    ],
  },
  {
    title: 'Data Input',
    items: [
      { slug: 'text-input', label: 'Text Input' },
      { slug: 'number-input', label: 'Number Input' },
      { slug: 'password-input', label: 'Password Input' },
      { slug: 'textarea-input', label: 'Textarea' },
      { slug: 'select-input', label: 'Select Input' },
      { slug: 'combobox-input', label: 'Combobox' },
      { slug: 'multiselect-input', label: 'Multi Select' },
      { slug: 'checkbox', label: 'Checkbox' },
      { slug: 'radio-group', label: 'Radio Group' },
      { slug: 'switch-input', label: 'Switch' },
      { slug: 'date-input', label: 'Date Input' },
      { slug: 'time-input', label: 'Time Input' },
      { slug: 'phone-input', label: 'Phone Input' },
      { slug: 'color-picker', label: 'Color Picker' },
      { slug: 'star-rating', label: 'Star Rating' },
      { slug: 'search-input', label: 'Search' },
      { slug: 'file-input', label: 'File Input' },
      { slug: 'image-input', label: 'Image Input' },
      { slug: 'emoji-input', label: 'Emoji Rating' },
      { slug: 'lang-input', label: 'Language Input' },
      { slug: 'slider', label: 'Slider' },
    ],
  },
  {
    title: 'Forms',
    items: [
      { slug: 'form', label: 'Form' },
      { slug: 'multi-step-form', label: 'Wizard Form' },
    ],
  },
  {
    title: 'Feedback',
    items: [
      { slug: 'spinner', label: 'Spinner' },
      { slug: 'skeleton', label: 'Skeleton' },
      { slug: 'loading-state', label: 'Loading State' },
      { slug: 'error-state', label: 'Error State' },
      { slug: 'empty-state', label: 'Empty State' },
      { slug: 'toast', label: 'Toast' },
    ],
  },
  {
    title: 'Overlays',
    items: [
      { slug: 'dialog', label: 'Dialog' },
      { slug: 'sheet', label: 'Sheet' },
      { slug: 'dropdown-menu', label: 'Dropdown Menu' },
      { slug: 'popover', label: 'Popover' },
      { slug: 'tooltip', label: 'Tooltip' },
      { slug: 'command', label: 'Command' },
    ],
  },
  {
    title: 'Layout',
    items: [
      { slug: 'app-shell', label: 'App Shell' },
      { slug: 'sidebar', label: 'Sidebar' },
      { slug: 'page-header', label: 'Page Header' },
      { slug: 'grid', label: 'Grid', badge: 'New' },
    ],
  },
  {
    title: 'JSON',
    items: [
      { slug: 'json-viewer', label: 'JSON Viewer' },
      { slug: 'json-editor', label: 'JSON Editor' },
    ],
  },
];
