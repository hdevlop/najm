import Link from "next/link";
import { ArrowRight, Zap, Shield, Database, Workflow, Globe, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { highlightCode } from "@/lib/highlight";
import { CodeTypingAnimation } from "@/components/code-typing-animation";

const features = [
  {
    icon: Code2,
    title: "Decorator-Based",
    description:
      "Intuitive decorators for controllers, services, and routes. Write clean, readable code.",
  },
  {
    icon: Zap,
    title: "Dependency Injection",
    description:
      "Powerful DI container with singleton, request, and transient scopes.",
  },
  {
    icon: Shield,
    title: "Guards & Auth",
    description:
      "Built-in guard system for authentication and authorization with role-based access.",
  },
  {
    icon: Database,
    title: "Database & Transactions",
    description:
      "Seamless database integration with automatic transaction management and retries.",
  },
  {
    icon: Workflow,
    title: "Event System",
    description:
      "Lightweight event emitter for decoupled communication between services.",
  },
  {
    icon: Globe,
    title: "i18n Support",
    description:
      "Built-in internationalization with translation decorators and language detection.",
  },
];

const codeExample = `import { Server } from 'najm-core';
import { router } from 'najm-router';
import { guards } from 'najm-guard';

@Controller('/api/users')
@Guards(AuthGuard)
class UserController {
  constructor(private userService: UserService) {}

  @Get('/:id')
  async getUser(@Params('id') id: string) {
    return this.userService.findById(id);
  }

  @Post('/')
  async createUser(@Body() data: CreateUserDto) {
    return this.userService.create(data);
  }
}

const server = new Server()
  .use(guards())
  .load(UserController, UserService);

await server.listen(3000);`;

export default async function HomePage() {
  const highlighted = await highlightCode(codeExample, "typescript");
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero Section */}
        <Hero centerImageSrc="/hero-center.png" />

        {/* Code Example Section */}
        <section className="container py-8 md:py-12 lg:py-24">
          <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
            <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-4xl font-bold">
              Clean, Expressive Code
            </h2>
            <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
              Write beautiful, maintainable APIs with TypeScript decorators.
            </p>
          </div>
          <div className="mx-auto max-w-4xl mt-8">
            <CodeTypingAnimation
              code={codeExample}
              highlightedCode={highlighted}
              speed={20}
            />
          </div>
        </section>

        {/* Features Section */}
        <section className="container space-y-6 py-8 md:py-12 lg:py-24 bg-secondary/50">
          <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
            <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-4xl font-bold">
              Features
            </h2>
            <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
              Everything you need to build production-ready APIs.
            </p>
          </div>
          <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="relative overflow-hidden rounded-lg border bg-background p-6"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="mt-4">
                  <h3 className="font-bold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="container py-8 md:py-12 lg:py-24">
          <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
            <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-4xl font-bold">
              Ready to Get Started?
            </h2>
            <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
              Install Najm and build your first API in minutes.
            </p>
            <div className="flex items-center gap-4 mt-4">
              <div className="rounded-lg border bg-muted px-4 py-2 font-mono text-sm">
                bun add najm-core najm-di hono
              </div>
            </div>
            <Button asChild size="lg" className="mt-4">
              <Link href="/docs/getting-started/introduction">
                Read the Documentation
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
            <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
              Built with love. Open source under MIT license.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
