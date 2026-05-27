import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { SidebarSection } from "@/components/sidebar";
import type { TocItem } from "@/components/toc";

const docsDirectory = path.join(process.cwd(), "content");

export interface DocMeta {
  title: string;
  description?: string;
  order?: number;
}

export interface Doc {
  slug: string[];
  content: string;
  meta: DocMeta;
}

export function getDocBySlug(slug: string[]): Doc | null {
  const realSlug = slug.join("/");
  const fullPath = path.join(docsDirectory, `${realSlug}.mdx`);

  if (!fs.existsSync(fullPath)) {
    // Try index file
    const indexPath = path.join(docsDirectory, realSlug, "index.mdx");
    if (fs.existsSync(indexPath)) {
      const fileContents = fs.readFileSync(indexPath, "utf8");
      const { data, content } = matter(fileContents);
      return {
        slug,
        content,
        meta: data as DocMeta,
      };
    }
    return null;
  }

  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);

  return {
    slug,
    content,
    meta: data as DocMeta,
  };
}

export function getAllDocs(): Doc[] {
  const docs: Doc[] = [];

  function walkDir(dir: string, slugPrefix: string[] = []) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        walkDir(filePath, [...slugPrefix, file]);
      } else if (file.endsWith(".mdx")) {
        const slug = file === "index.mdx"
          ? slugPrefix
          : [...slugPrefix, file.replace(/\.mdx$/, "")];

        const fileContents = fs.readFileSync(filePath, "utf8");
        const { data, content } = matter(fileContents);

        docs.push({
          slug,
          content,
          meta: data as DocMeta,
        });
      }
    }
  }

  walkDir(docsDirectory);
  return docs;
}

export function getDocsSidebar(): SidebarSection[] {
  const docs = getAllDocs();

  // Group docs by their first slug segment with better categorization
  const groups: Record<string, { title: string; href: string; order: number }[]> = {
    "Getting Started": [],
    "Core Concepts": [],
    "Routing & HTTP": [],
    "Security": [],
    "Plugins": [],
    "Guides": [],
    "Testing": [],
    "Deployment": [],
    "API Reference": [],
  };

  const sectionMapping: Record<string, string> = {
    // Getting Started
    "getting-started": "Getting Started",
    "introduction": "Getting Started",
    "installation": "Getting Started",
    "quick-start": "Getting Started",

    // Core Concepts
    "core": "Core Concepts",
    "di": "Core Concepts",
    "server": "Core Concepts",
    "decorators": "Core Concepts",

    // Routing & HTTP (mapping the "routing" folder)
    "routing": "Routing & HTTP",
    "router": "Routing & HTTP",
    "controllers": "Routing & HTTP",
    "params": "Routing & HTTP",
    "validation": "Routing & HTTP",
    "middleware": "Routing & HTTP",

    // Security (mapping the "security" folder)
    "security": "Security",
    "guards": "Security",
    "auth": "Security",
    "cors": "Security",
    "cookies": "Security",
    "rate-limit": "Security",

    // Plugins (mapping the "plugins" folder to Plugins)
    "plugins": "Plugins",
    "database": "Plugins",
    "events": "Plugins",
    "i18n": "Plugins",
    "email": "Plugins",
    "caching": "Plugins",

    // Guides
    "guides": "Guides",

    // Testing
    "testing": "Testing",

    // Deployment
    "deployment": "Deployment",

    // API Reference
    "api": "API Reference",
  };

  for (const doc of docs) {
    const firstSegment = doc.slug[0] || "getting-started";
    const section = sectionMapping[firstSegment] || "Core Concepts";

    if (!groups[section]) {
      groups[section] = [];
    }

    groups[section].push({
      title: doc.meta.title || doc.slug[doc.slug.length - 1] || "Introduction",
      href: `/docs/${doc.slug.join("/")}`,
      order: doc.meta.order ?? 999,
    });
  }

  // Sort items within each group
  for (const section of Object.keys(groups)) {
    groups[section].sort((a, b) => a.order - b.order);
  }

  // Convert to sidebar sections - only include non-empty sections
  const sections: SidebarSection[] = [];
  const sectionOrder = [
    "Getting Started",
    "Core Concepts",
    "Routing & HTTP",
    "Security",
    "Plugins",
    "Guides",
    "Testing",
    "Deployment",
    "API Reference"
  ];

  for (const sectionTitle of sectionOrder) {
    if (groups[sectionTitle]?.length > 0) {
      sections.push({
        title: sectionTitle,
        items: groups[sectionTitle].map(({ title, href }) => ({ title, href })),
      });
    }
  }

  return sections;
}

export function extractToc(content: string): TocItem[] {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const items: TocItem[] = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const title = match[2];
    const id = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    items.push({ id, title, level });
  }

  return items;
}
