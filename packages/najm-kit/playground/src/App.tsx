import React, { useState, useEffect } from 'react';
import { NajmThemeProvider, NDialog, Toaster, TooltipProvider , NButton } from 'najm-kit';
import type { NajmThemeTokens } from 'najm-kit';
import { Moon, Sun, Menu, X, Github, ArrowLeft, ArrowRight } from 'lucide-react';
import { Sidebar } from './docs/Sidebar';
import { navGroups } from './docs/navigation';

import { IntroductionPage } from './docs/pages/IntroductionPage';
import { ButtonPage } from './docs/pages/ButtonPage';
import { BadgePage } from './docs/pages/BadgePage';
import { IndicatorPage } from './docs/pages/IndicatorPage';
import { AlertPage } from './docs/pages/AlertPage';
import { NAvatarPage } from './docs/pages/NAvatarPage';
import { CardPage } from './docs/pages/CardPage';
import { ProgressPage } from './docs/pages/ProgressPage';
import { TabsPage } from './docs/pages/TabsPage';
import { SpinnerPage } from './docs/pages/SpinnerPage';
import { SkeletonPage } from './docs/pages/SkeletonPage';
import { LoadingStatePage } from './docs/pages/LoadingStatePage';
import { ErrorStatePage } from './docs/pages/ErrorStatePage';
import { EmptyStatePage } from './docs/pages/EmptyStatePage';
import { ToastPage } from './docs/pages/ToastPage';
import { InputsPage } from './docs/pages/InputsPage';
import { DialogPage } from './docs/pages/DialogPage';
import { SheetPage } from './docs/pages/SheetPage';
import { TooltipPage } from './docs/pages/TooltipPage';
import { DropdownPage } from './docs/pages/DropdownPage';
import { TablePage } from './docs/pages/TablePage';
import { StatCardPage } from './docs/pages/StatCardPage';
import { SwapPage } from './docs/pages/SwapPage';
import { TogglePage } from './docs/pages/TogglePage';
import { ComingSoonPage } from './docs/pages/ComingSoonPage';
import { FormPage } from './docs/pages/FormPage';
import { AppShellPage } from './docs/pages/AppShellPage';
import { SidebarPage } from './docs/pages/SidebarPage';
import { PageHeaderPage } from './docs/pages/PageHeaderPage';
import { WizardFormPage } from './docs/pages/MultiStepFormPage';
import { ThemeJsonPage } from './docs/pages/ThemeJsonPage';

const DEEP_DARK_TOKENS: NajmThemeTokens = {
  background: 'oklch(0.145 0.024 285.7)',
  foreground: 'oklch(0.968 0.001 286.375)',
  card: 'oklch(0.21 0.034 285.3)',
  'card-foreground': 'oklch(0.968 0.001 286.375)',
  popover: 'oklch(0.21 0.034 285.3)',
  'popover-foreground': 'oklch(0.968 0.001 286.375)',
  primary: 'oklch(0.4865 0.2423 291.866)',
  'primary-foreground': 'oklch(1 0 0)',
  secondary: 'oklch(0.274 0.024 285.5)',
  'secondary-foreground': 'oklch(0.92 0.003 286.332)',
  muted: 'oklch(0.274 0.024 285.5)',
  'muted-foreground': 'oklch(0.7 0.017 285.896)',
  destructive: 'oklch(0.6368 0.2078 25.326)',
  'destructive-foreground': 'oklch(1 0 0)',
  border: 'oklch(0.32 0.029 285.8)',
  input: 'oklch(0.32 0.029 285.8)',
  ring: 'oklch(0.6016 0.2214 292.234)',
  radius: '0.5rem',
};

const pageRegistry: Record<string, () => React.ReactElement> = {
  introduction: () => <IntroductionPage />,
  'theme-json-dashboard': () => <ThemeJsonPage />,
  button: () => <ButtonPage />,
  toggle: () => <TogglePage />,
  swap: () => <SwapPage />,
  badge: () => <BadgePage />,
  indicator: () => <IndicatorPage />,
  alert: () => <AlertPage />,
  navatar: () => <NAvatarPage />,
  card: () => <CardPage />,
  progress: () => <ProgressPage />,
  tabs: () => <TabsPage />,
  separator: () => <ComingSoonPage name="Separator" />,
  'stat-card': () => <StatCardPage />,
  'detail-card': () => <ComingSoonPage name="Detail Card" />,
  table: () => <TablePage />,
  'text-input': () => <InputsPage slug="text-input" />,
  'number-input': () => <InputsPage slug="number-input" />,
  'password-input': () => <InputsPage slug="password-input" />,
  'textarea-input': () => <InputsPage slug="textarea-input" />,
  'select-input': () => <InputsPage slug="select-input" />,
  'combobox-input': () => <InputsPage slug="combobox-input" />,
  'multiselect-input': () => <InputsPage slug="multiselect-input" />,
  checkbox: () => <InputsPage slug="checkbox" />,
  'radio-group': () => <InputsPage slug="radio-group" />,
  'switch-input': () => <InputsPage slug="switch-input" />,
  'date-input': () => <InputsPage slug="date-input" />,
  'time-input': () => <InputsPage slug="time-input" />,
  'phone-input': () => <InputsPage slug="phone-input" />,
  'color-picker': () => <InputsPage slug="color-picker" />,
  'star-rating': () => <InputsPage slug="star-rating" />,
  'search-input': () => <InputsPage slug="search-input" />,
  'file-input': () => <InputsPage slug="file-input" />,
  'image-input': () => <InputsPage slug="image-input" />,
  'emoji-input': () => <InputsPage slug="emoji-input" />,
  'lang-input': () => <InputsPage slug="lang-input" />,
  slider: () => <InputsPage slug="slider" />,
  form: () => <FormPage />,
  'multi-step-form': () => <WizardFormPage />,
  spinner: () => <SpinnerPage />,
  skeleton: () => <SkeletonPage />,
  'loading-state': () => <LoadingStatePage />,
  'error-state': () => <ErrorStatePage />,
  'empty-state': () => <EmptyStatePage />,
  toast: () => <ToastPage />,
  dialog: () => <DialogPage />,
  sheet: () => <SheetPage />,
  'dropdown-menu': () => <DropdownPage />,
  popover: () => <ComingSoonPage name="Popover" />,
  tooltip: () => <TooltipPage />,
  command: () => <ComingSoonPage name="Command" />,
  'app-shell': () => <AppShellPage />,
  sidebar: () => <SidebarPage />,
  'page-header': () => <PageHeaderPage />,
  installation: () => <ComingSoonPage name="Installation" />,
  theming: () => <ComingSoonPage name="Theming" />,
  'json-viewer': () => <ComingSoonPage name="JSON Viewer" />,
  'json-editor': () => <ComingSoonPage name="JSON Editor" />,
};

const allItems = navGroups.flatMap((g) => g.items);

export default function App() {
  const [activePage, setActivePage] = useState('introduction');
  const [mode, setMode] = useState<'light' | 'dark'>('dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentIndex = allItems.findIndex((i) => i.slug === activePage);
  const prevItem = currentIndex > 0 ? allItems[currentIndex - 1] : null;
  const nextItem = currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null;

  const navigate = (slug: string) => {
    setActivePage(slug);
    setSidebarOpen(false);
    window.scrollTo({ top: 0 });
  };

  const renderPage = pageRegistry[activePage] ?? (() => <IntroductionPage />);

  useEffect(() => {
    if (!sidebarOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [sidebarOpen]);

  return (
    <NajmThemeProvider
      mode={mode}
      accent="violet"
      tokens={mode === 'dark' ? DEEP_DARK_TOKENS : undefined}
      className="min-h-screen bg-background text-foreground"
    >
      <TooltipProvider>
        <div className="flex h-screen flex-col">
          <header className="h-13 flex shrink-0 items-center border-b border-slate-800/60 bg-[hsl(222,47%,8%)] px-4 gap-3 z-50">
            <NButton
              className="md:hidden flex items-center justify-center size-8 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </NButton>

            <div
              className="flex items-center gap-2 cursor-pointer select-none"
              onClick={() => navigate('introduction')}
            >
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-bold tracking-tight text-slate-100">
                  najm<span className="text-amber-400">-ui</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded hidden sm:inline">
                  v0.0.5
                </span>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-1">
              <NButton
                onClick={() => setMode((m) => (m === 'light' ? 'dark' : 'light'))}
                className="flex items-center justify-center size-8 rounded-lg text-amber-400 hover:bg-slate-800/60 transition-colors"
                aria-label="Toggle theme"
              >
                {mode === 'light' ? <Moon size={16} /> : <Sun size={16} />}
              </NButton>

              <a
                href="https://github.com/hdevlop87/najm"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center size-8 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
                aria-label="GitHub"
              >
                <Github size={16} />
              </a>
            </div>
          </header>

          <div className="flex flex-1 min-h-0">
            <div className="hidden md:flex shrink-0">
              <Sidebar activePage={activePage} onNavigate={navigate} />
            </div>

            {sidebarOpen && (
              <div className="fixed inset-0 z-40 md:hidden" onClick={() => setSidebarOpen(false)}>
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
              </div>
            )}
            <div
              className={[
                'fixed top-0 bottom-0 left-0 z-50 md:hidden transition-transform duration-300 ease-in-out',
                sidebarOpen ? 'translate-x-0' : '-translate-x-full',
              ].join(' ')}
            >
              <div className="h-13 flex items-center px-4 border-b border-slate-800/60 bg-[hsl(222,47%,8%)]">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-bold tracking-tight text-slate-100">
                    najm<span className="text-amber-400">-ui</span>
                  </span>
                </div>
                <NButton
                  className="ml-auto flex items-center justify-center size-8 rounded-lg text-slate-400 hover:text-slate-200"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close menu"
                >
                  <X size={18} />
                </NButton>
              </div>
              <Sidebar activePage={activePage} onNavigate={navigate} />
            </div>

            <main className="flex-1 overflow-y-auto bg-[hsl(240,10%,3.9%)]">
              <div className="mx-auto w-full max-w-7xl px-6 py-8 md:px-10 md:py-10">
                {renderPage()}

                {(prevItem || nextItem) && (
                  <div className="mt-16 pt-8 border-t border-slate-800/60 flex items-center justify-between gap-4">
                    {prevItem ? (
                      <NButton
                        onClick={() => navigate(prevItem.slug)}
                        className="group flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-800/60 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-700 transition-all text-sm font-medium text-slate-200 hover:text-amber-400 max-w-xs"
                      >
                        <ArrowLeft size={16} className="shrink-0 transition-transform group-hover:-translate-x-0.5" />
                        <span className="truncate">{prevItem.label}</span>
                      </NButton>
                    ) : (
                      <div />
                    )}

                    {nextItem ? (
                      <NButton
                        onClick={() => navigate(nextItem.slug)}
                        className="group flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-800/60 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-700 transition-all text-sm font-medium text-slate-200 hover:text-amber-400 max-w-xs"
                      >
                        <span className="truncate">{nextItem.label}</span>
                        <ArrowRight size={16} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
                      </NButton>
                    ) : (
                      <div />
                    )}
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>

        <Toaster />
        <NDialog />
      </TooltipProvider>
    </NajmThemeProvider>
  );
}
