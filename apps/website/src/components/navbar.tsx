"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, Github, Menu, X } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import Image from "next/image";

const navItems = [
  { href: "/docs", label: "Documentation" },
  { href: "/docs/guides", label: "Guides" },
  { href: "/docs/api", label: "API Reference" },
];

export function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center max-w-[1800px] mx-auto w-full px-4 md:px-6">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Image
              src="/logo.png"
              alt="Najm Logo"
              width={40}
              height={40}
              className="h-10 w-auto"
            />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "transition-colors hover:text-foreground/80",
                  pathname?.startsWith(item.href)
                    ? "text-foreground"
                    : "text-foreground/60"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <nav className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="hidden md:inline-flex"
            >
              <Link
                href="https://github.com/user/najm"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-4 w-4" />
                <span className="sr-only">GitHub</span>
              </Link>
            </Button>
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </Button>
          </nav>
        </div>
      </div>
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t">
          <nav className="py-4 flex flex-col gap-2 max-w-[1800px] mx-auto w-full px-4 md:px-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-4 py-2 rounded-md transition-colors",
                  pathname?.startsWith(item.href)
                    ? "bg-accent text-foreground"
                    : "text-foreground/60 hover:bg-accent hover:text-foreground"
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="https://github.com/user/najm"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-md text-foreground/60 hover:bg-accent hover:text-foreground flex items-center gap-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Github className="h-4 w-4" />
              GitHub
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
