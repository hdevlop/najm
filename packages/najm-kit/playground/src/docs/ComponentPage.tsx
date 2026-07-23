import React from 'react';

interface ComponentPageProps {
  title: string;
  description: string;
  category?: string;
  children: React.ReactNode;
}

export function ComponentPage({ title, description, category, children }: ComponentPageProps) {
  return (
    <div className="space-y-10">
      <div className="pb-6 border-b border-slate-800/60 space-y-2">
        {category && (
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            {category}
          </span>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">{title}</h1>
        <p className="text-base text-slate-400 leading-relaxed">{description}</p>
      </div>

      {children}
    </div>
  );
}
