import React from 'react';
import { Badge } from 'najm-kit';
import { Layers, Zap, Palette, Code2, Package, Shield } from 'lucide-react';

const features = [
  {
    icon: <Layers size={20} />,
    title: '100+ Components',
    desc: 'Primitives, inputs, data display, feedback, overlays, layout — all in one package.',
  },
  {
    icon: <Zap size={20} />,
    title: 'Fully Typed',
    desc: 'Every prop, variant, and callback typed with TypeScript for great IDE support.',
  },
  {
    icon: <Palette size={20} />,
    title: 'Themeable',
    desc: 'Light & dark mode with accent color presets. Override tokens per component.',
  },
  {
    icon: <Code2 size={20} />,
    title: 'Tailwind-powered',
    desc: 'Built on Tailwind CSS with CVA for composable variant styles.',
  },
  {
    icon: <Package size={20} />,
    title: 'Radix UI foundation',
    desc: 'Accessible primitives from Radix UI under the hood for dialogs, menus, and more.',
  },
  {
    icon: <Shield size={20} />,
    title: 'Form-ready',
    desc: 'All inputs integrate with react-hook-form and Zod validation out of the box.',
  },
];

const categories = [
  { name: 'Primitives', count: '32+', color: 'bg-sky-500/10 text-sky-400' },
  { name: 'Inputs', count: '20+', color: 'bg-violet-500/10 text-violet-400' },
  { name: 'Forms', count: '5+', color: 'bg-pink-500/10 text-pink-400' },
  { name: 'Data Display', count: '15+', color: 'bg-amber-500/10 text-amber-400' },
  { name: 'Feedback', count: '10+', color: 'bg-emerald-500/10 text-emerald-400' },
  { name: 'Overlays', count: '8+', color: 'bg-red-500/10 text-red-400' },
  { name: 'Layout', count: '6+', color: 'bg-cyan-500/10 text-cyan-400' },
  { name: 'JSON', count: '2', color: 'bg-orange-500/10 text-orange-400' },
];

export function IntroductionPage() {
  return (
    <div className="space-y-12">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono border-amber-500/30 text-amber-400">v0.0.5</Badge>
          <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">Beta</Badge>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-100">
          najm<span className="text-amber-400">-ui</span>
        </h1>
        <p className="text-lg text-slate-400 leading-relaxed max-w-xl">
          A modular, accessible, and themeable React component library built on Radix UI and
          Tailwind CSS — designed for the Najm framework ecosystem.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-200">Quick install</h2>
        <div className="rounded-xl overflow-hidden border border-slate-800/80">
          <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800/60">
            <span className="text-[11px] font-mono text-slate-500">bash</span>
          </div>
          <pre className="bg-slate-950 p-4 font-mono text-sm">
            <code className="text-amber-300">bun add najm-kit</code>
          </pre>
        </div>

        <div className="rounded-xl overflow-hidden border border-slate-800/80">
          <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800/60">
            <span className="text-[11px] font-mono text-slate-500">tsx</span>
          </div>
          <pre className="bg-slate-950 p-4 font-mono text-sm leading-relaxed text-slate-300">
            <code>{`// main.tsx or layout.tsx
@import "tailwindcss";
@import "najm-kit/theme.css";
import { NajmThemeProvider } from 'najm-kit';

export default function Root({ children }) {
  return (
    <NajmThemeProvider mode="light" accent="violet">
      {children}
    </NajmThemeProvider>
  );
}`}</code>
          </pre>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-200">Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((f) => (
            <div key={f.title} className="border border-slate-800/60 rounded-xl p-4 space-y-2 bg-slate-900/40 hover:bg-slate-800/40 transition-colors">
              <div className="text-amber-400">{f.icon}</div>
              <div className="font-semibold text-sm text-slate-200">{f.title}</div>
              <div className="text-sm text-slate-400">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-200">Component categories</h2>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <div key={c.name} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${c.color}`}>
              <span>{c.name}</span>
              <span className="text-xs opacity-70">{c.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
