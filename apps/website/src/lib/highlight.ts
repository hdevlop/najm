import { createHighlighter, type Highlighter } from "shiki";
import oneDarkPro from "shiki/themes/one-dark-pro.mjs";

// Theme name from imported object
const DARK_THEME = oneDarkPro.name as string;

// Global singleton to prevent multiple instances during static generation
const globalForShiki = globalThis as unknown as {
  shikiHighlighter: Highlighter | undefined;
  shikiPromise: Promise<Highlighter> | undefined;
};

export async function getHighlighter(): Promise<Highlighter> {
  if (globalForShiki.shikiHighlighter) {
    return globalForShiki.shikiHighlighter;
  }

  if (!globalForShiki.shikiPromise) {
    globalForShiki.shikiPromise = createHighlighter({
      themes: [oneDarkPro, "github-light"],
      langs: [
        "typescript",
        "javascript",
        "tsx",
        "jsx",
        "bash",
        "shell",
        "json",
        "yaml",
        "markdown",
        "sql",
      ],
    }).then((h) => {
      globalForShiki.shikiHighlighter = h;
      return h;
    });
  }

  return globalForShiki.shikiPromise;
}

export async function highlightCode(
  code: string,
  lang: string = "typescript"
): Promise<string> {
  const h = await getHighlighter();

  // Map common language aliases
  const langMap: Record<string, string> = {
    ts: "typescript",
    js: "javascript",
    sh: "bash",
    zsh: "bash",
    yml: "yaml",
    md: "markdown",
  };

  const normalizedLang = langMap[lang] || lang;

  try {
    return h.codeToHtml(code, {
      lang: normalizedLang,
      theme: DARK_THEME,
    });
  } catch {
    // Fallback for unsupported languages
    return h.codeToHtml(code, {
      lang: "text",
      theme: DARK_THEME,
    });
  }
}
