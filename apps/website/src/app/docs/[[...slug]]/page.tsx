
import React from "react";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getDocBySlug, getAllDocs, extractToc } from "@/lib/docs";
import { mdxComponents } from "@/components/mdx-components";
import { TableOfContents } from "@/components/toc";
import { CopyButton } from "@/components/copy-button";
import { highlightCode } from "@/lib/highlight";
import type { Metadata } from "next";

interface DocPageProps {
  params: Promise<{
    slug?: string[];
  }>;
}

export async function generateStaticParams() {
  const docs = getAllDocs();
  return docs.map((doc) => ({
    slug: doc.slug.length > 0 ? doc.slug : undefined,
  }));
}

export async function generateMetadata({
  params,
}: DocPageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocBySlug(slug || ["getting-started", "introduction"]);

  if (!doc) {
    return {
      title: "Not Found",
    };
  }

  return {
    title: doc.meta.title,
    description: doc.meta.description,
  };
}

// Custom components that need async processing
async function Pre({ children, ...props }: { children: React.ReactNode }) {
  // Extract code content from children
  const codeElement = children as React.ReactElement<{
    children: string;
    className?: string;
  }>;

  if (codeElement?.props?.children) {
    const code = codeElement.props.children;
    const className = codeElement.props.className || "";
    const langMatch = className.match(/language-(\w+)/);
    const lang = langMatch ? langMatch[1] : "typescript";

    const highlighted = await highlightCode(code.trim(), lang);

    return (
      <div className="relative my-4 rounded-lg border border-[#3e4451] bg-[#282c34] dark:bg-[#282c34] w-full group">
        {lang && (
          <div className="flex items-center justify-between border-b border-[#3e4451] bg-[#21252b] dark:bg-[#21252b] px-4 py-2 rounded-t-lg">
            <span className="text-sm text-[#abb2bf]">{lang}</span>
            <CopyButton code={code.trim()} />
          </div>
        )}
        <div
          className="overflow-x-auto text-sm p-4 [&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </div>
    );
  }

  return <pre {...props}>{children}</pre>;
}

export default async function DocPage({ params }: DocPageProps) {
  const { slug } = await params;
  const doc = getDocBySlug(slug || ["getting-started", "introduction"]);

  if (!doc) {
    notFound();
  }

  const toc = extractToc(doc.content);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_250px] gap-10 w-full">
      <div className="w-full overflow-hidden">
        <div className="mb-4 flex items-center space-x-1 text-sm text-muted-foreground">
          <span>Docs</span>
          {doc.slug.map((segment, index) => (
            <span key={index}>
              <span className="mx-1">/</span>
              <span className={index === doc.slug.length - 1 ? "text-foreground" : ""}>
                {segment}
              </span>
            </span>
          ))}
        </div>
        <div className="space-y-2">
          <h1 className="scroll-m-20 text-2xl font-medium tracking-tight" style={{ color: 'rgb(242, 237, 237)', lineHeight: '1.2' }}>
            {doc.meta.title}
          </h1>
          {doc.meta.description && (
            <p className="text-sm" style={{ color: 'rgb(184, 178, 178)' }}>
              {doc.meta.description}
            </p>
          )}
        </div>
        <div className="prose pb-12 pt-8 max-w-none">
          <MDXRemote
            source={doc.content}
            components={{
              ...mdxComponents,
              pre: Pre,
            }}
          />
        </div>
        <div className="border-t pt-6 mt-12">
          <a
            href={`https://github.com/kefaslungu/najm/edit/master/packages/website/content/${doc.slug.join("/")}.mdx`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit this page on GitHub
          </a>
        </div>
      </div>
      <div className="hidden text-sm xl:block">
        <div className="sticky top-16 pt-4">
          <TableOfContents items={toc} />
        </div>
      </div>
    </div>
  );
}
