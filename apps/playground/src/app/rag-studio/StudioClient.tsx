'use client';

export default function StudioClient() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <section className="max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-violet-300">RAG Studio</p>
        <h1 className="mt-4 text-3xl font-semibold">Use the standalone Studio app</h1>
        <p className="mt-4 text-base leading-7 text-slate-300">
          The playground exposes the RAG Studio API at <code className="rounded bg-white/10 px-1.5 py-0.5">/api/rag-studio</code>.
          Run <code className="rounded bg-white/10 px-1.5 py-0.5">bun run --cwd ../rag-studio dev</code>,
          then add this API root as a connection: <code className="rounded bg-white/10 px-1.5 py-0.5">/api</code>.
        </p>
      </section>
    </main>
  );
}
