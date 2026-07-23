import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center">
        <div className="container flex flex-col items-center justify-center gap-4 text-center">
          <h1 className="text-4xl font-bold">404</h1>
          <p className="text-xl text-muted-foreground">Page not found</p>
          <p className="text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist.
          </p>
          <div className="flex gap-4 mt-4">
            <Button asChild>
              <Link href="/">Go Home</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/docs">Documentation</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
