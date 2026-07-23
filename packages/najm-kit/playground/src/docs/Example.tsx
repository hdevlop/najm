import React, { useState } from 'react';
import { Copy, Check, Monitor, Tablet, Smartphone, Moon, Sun, AlignRight } from 'lucide-react';
import { NajmThemeProvider , NButton } from 'najm-kit';
import { CodeBlock } from './CodeBlock';

type Viewport = 'desktop' | 'tablet' | 'mobile';
type TabMode = 'preview' | 'jsx';

const VIEWPORT_SIZES: Record<Viewport, { width: number; height: number; label: string }> = {
  desktop: { width: 0, height: 0, label: 'Desktop' },
  tablet: { width: 768, height: 500, label: 'Tablet' },
  mobile: { width: 375, height: 600, label: 'Mobile' },
};

const PREVIEW_BG = {
  dark:  'bg-slate-950',
  light: 'bg-gray-200',
};

const THEME = {
  dark:  { border: 'border-slate-700/50' },
  light: { border: 'border-slate-200'    },
} as const;

interface ExampleProps {
  title?: string;
  description?: string;
  code: string;
  lang?: string;
  children: React.ReactNode;
  center?: boolean;
  noPad?: boolean;
  defaultOpen?: boolean;
  previewHeight?: string;
}

export function Example({
  title,
  description,
  code,
  lang = 'jsx',
  children,
  center = true,
  noPad = false,
  previewHeight = 'h-64',
}: ExampleProps) {
  const [tab, setTab] = useState<TabMode>('preview');
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [previewTheme, setPreviewTheme] = useState<'dark' | 'light'>('dark');
  const [rtl, setRtl] = useState(false);
  const [copied, setCopied] = useState(false);

  const vp = VIEWPORT_SIZES[viewport];
  const isConstrained = viewport !== 'desktop';
  const theme = THEME[previewTheme];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const TABS: { key: TabMode; label: string }[] = [
    { key: 'preview', label: 'Preview' },
    { key: 'jsx', label: 'JSX' },
  ];

  const VIEWPORTS: { key: Viewport; Icon: React.ElementType }[] = [
    { key: 'desktop', Icon: Monitor },
    { key: 'tablet', Icon: Tablet },
    { key: 'mobile', Icon: Smartphone },
  ];

  return (
    <div className="space-y-3">
      {(title || description) && (
        <div className="space-y-0.5">
          {title && <h3 className="text-sm font-semibold text-slate-200">{title}</h3>}
          {description && <p className="text-sm text-slate-400">{description}</p>}
        </div>
      )}

      <div className="rounded-xl border border-slate-700/50 overflow-hidden">
        {/* Toolbar */}
        <div className="grid grid-cols-3 items-center px-2 h-10 border-b border-slate-700/50 bg-[#0f172a]">
          {/* Left: tabs */}
          <div className="flex items-center gap-0.5">
            {TABS.map(({ key, label }) => (
              <NButton
                key={key}
                onClick={() => setTab(key)}
                className={[
                  'px-3 h-7 text-xs font-medium rounded transition-colors',
                  tab === key
                    ? 'bg-slate-700/70 text-slate-100'
                    : 'text-slate-500 hover:text-slate-300',
                ].join(' ')}
              >
                {label}
              </NButton>
            ))}
          </div>

          {/* Center: viewport icons */}
          <div className="flex items-center justify-center gap-0.5">
            {VIEWPORTS.map(({ key, Icon }) => (
              <NButton
                key={key}
                onClick={() => setViewport(key)}
                className={[
                  'flex items-center justify-center size-7 rounded transition-colors',
                  viewport === key ? 'text-slate-200' : 'text-slate-600 hover:text-slate-400',
                ].join(' ')}
                aria-label={VIEWPORT_SIZES[key].label}
              >
                <Icon size={14} />
              </NButton>
            ))}
          </div>

          {/* Right: copy, RTL, theme */}
          <div className="flex items-center justify-end gap-0.5">
            <NButton
              onClick={handleCopy}
              className="flex items-center justify-center size-7 rounded text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Copy code"
            >
              {copied ? (
                <Check size={13} className="text-emerald-400" />
              ) : (
                <Copy size={13} />
              )}
            </NButton>

            <NButton
              onClick={() => setRtl((r) => !r)}
              className={[
                'flex items-center gap-1 px-2 h-7 rounded text-xs font-medium transition-colors',
                rtl ? 'text-slate-200' : 'text-slate-500 hover:text-slate-300',
              ].join(' ')}
              aria-label="Toggle RTL"
            >
              RTL
              <AlignRight size={11} />
            </NButton>

            <NButton
              onClick={() => setPreviewTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              className={[
                'flex items-center justify-center size-7 rounded transition-colors',
                previewTheme === 'dark'
                  ? 'text-amber-400 bg-amber-500/10'
                  : 'text-slate-500 hover:text-slate-300',
              ].join(' ')}
              aria-label="Toggle theme"
            >
              {previewTheme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
            </NButton>
          </div>
        </div>

        {/* Fixed-height content area — prevents layout shift on tab change */}
        <div className={`relative overflow-hidden ${previewHeight}`}>
          {/* Preview panel */}
          <div
            className={[
              'absolute inset-0 flex justify-center ',
              tab !== 'preview' ? 'hidden' : '',
            ].join(' ')}
          >
            <div
              className={[
                'h-full w-full',
                isConstrained
                  ? `rounded-lg border overflow-hidden  ${theme.border}`
                  : '',
              ].join(' ')}
              style={isConstrained ? { width: vp.width, height: vp.height } : undefined}
            >
              <NajmThemeProvider
                mode={previewTheme}
                accent="violet"
                className={[
                  `h-full overflow-auto p-4 ${PREVIEW_BG[previewTheme]} text-foreground`,
                  previewTheme === 'dark' ? 'dark' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div
                  dir={rtl ? 'rtl' : 'ltr'}
                  className={[
                    'h-full',
                    noPad ? '' : 'p-8',
                    center ? 'flex flex-wrap items-center justify-center gap-3' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {children}
                </div>
              </NajmThemeProvider>
            </div>
          </div>

          {/* Code panel */}
          <div
            className={[
              'absolute inset-0 overflow-auto',
              tab === 'preview' ? 'hidden' : '',
            ].join(' ')}
          >
            <CodeBlock code={code} lang={lang} bare />
          </div>
        </div>
      </div>
    </div>
  );
}
