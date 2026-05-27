import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";
import { getDocsSidebar } from "@/lib/docs";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sidebar = getDocsSidebar();

  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1 items-start md:grid md:grid-cols-[220px_1fr] md:gap-6 lg:grid-cols-[240px_1fr] lg:gap-10 max-w-[1800px] mx-auto w-full px-4 md:px-6">
        <Sidebar sections={sidebar} />
        <main className="relative py-6 lg:py-8 w-full overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
