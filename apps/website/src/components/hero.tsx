"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  AtSign,
  Shield,
  Database,
  Zap,
  Globe,
  Lock,
  Code2,
  Workflow,
  Cookie,
  Server,
  Layers,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeroProps {
  /** Path to the center hero image (Sora-generated) */
  centerImageSrc?: string;
  /** Alt text for the center image */
  centerImageAlt?: string;
}

export function Hero({
  centerImageSrc = "/hero-center.png",
  centerImageAlt = "Najm Framework",
}: HeroProps) {
  return (
    <section className="relative min-h-[90vh] w-full overflow-hidden bg-[#0a0a12]">
      {/* Background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Top-left purple orb */}
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-purple-600/20 blur-[128px]" />
        {/* Top-right cyan orb */}
        <div className="absolute -right-32 top-20 h-80 w-80 rounded-full bg-cyan-500/20 blur-[100px]" />
        {/* Bottom-left blue orb */}
        <div className="absolute -bottom-20 left-1/4 h-72 w-72 rounded-full bg-blue-500/15 blur-[80px]" />
        {/* Bottom-right purple orb */}
        <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-purple-500/15 blur-[120px]" />
        {/* Center subtle glow */}
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 blur-[150px]" />
      </div>

      {/* Floating Icons */}
      <FloatingIcons />

      {/* Content */}
      <div className="container relative z-10 flex flex-col items-center justify-center px-4 py-20 lg:py-28">
        {/* Headline */}
        <h1 className="mb-6 text-center text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
          The Framework You{" "}
          <span className="relative inline-block">
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              Deserve
            </span>
            {/* Underline decoration */}
            <span className="absolute -bottom-2 left-0 h-1 w-full rounded-full bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400" />
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mb-12 max-w-2xl text-center text-lg text-gray-400 sm:text-xl">
          Experience unmatched speed, robust security,
          <br className="hidden sm:block" /> and superior developer experience.
        </p>

        {/* Main content area - 3 columns on desktop */}
        <div className="mb-12 grid w-full max-w-6xl gap-16 lg:grid-cols-3 lg:items-center">
          {/* Left - Feature list card */}
          <div className="flex justify-center ">
            <div className="rounded-2xl border border-gray-700/50 bg-gray-900/60 px-6 py-5 backdrop-blur-sm">
              <ul className="space-y-3 text-sm text-gray-300">
                <li className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                  3x faster
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                  Type-safe
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                  Decorator-first
                </li>
              </ul>
            </div>
          </div>

          {/* Center - Hero image placeholder */}
          <div className="flex justify-center">
            <div className="relative h-[300px] w-[300px] ">
              {/* Glow effect behind image */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500/30 via-purple-500/20 to-cyan-500/30 blur-3xl" />
              <Image
                src={centerImageSrc}
                alt={centerImageAlt}
                fill
                className="relative z-10 object-contain"
                priority
              />
            </div>
          </div>

          {/* Right - Code preview */}
          <div className="flex justify-end lg:justify-end">
            <CodePreview />
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button
            asChild
            size="lg"
            className="bg-emerald-500 px-8 text-white hover:bg-emerald-600"
          >
            <Link href="/docs/getting-started/introduction">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="border-gray-600 bg-transparent px-8 text-white hover:bg-gray-800"
          >
            <Link href="/docs">View Docs</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function CodePreview() {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900/90 shadow-2xl backdrop-blur-sm">
      {/* Window header */}
      <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
        <div className="h-3 w-3 rounded-full bg-red-500" />
        <div className="h-3 w-3 rounded-full bg-yellow-500" />
        <div className="h-3 w-3 rounded-full bg-green-500" />
      </div>
      {/* Code content */}
      <div className="p-4 font-mono text-xs leading-relaxed">
        {/* Decorators */}
        <div className="text-yellow-400">@Permission(...)</div>
        <div className="text-yellow-400">@RateLimit(...)</div>
        <div className="text-yellow-400">@Validate</div>

        {/* Class declaration */}
        <div className="mt-2">
          <span className="text-pink-400">class </span>
          <span className="text-cyan-400">UserController</span>
          <span className="text-gray-400"> {"{"}</span>
        </div>

        {/* Method */}
        <div className="mt-2 pl-4">
          <span className="text-yellow-400">@Post</span>
          <span className="text-gray-400">(</span>
          <span className="text-emerald-400">&apos;/&apos;</span>
          <span className="text-gray-400">)</span>
        </div>
        <div className="pl-4">
          <span className="text-purple-400">create</span>
          <span className="text-gray-400">(</span>
          <span className="text-yellow-400">@Body</span>
          <span className="text-gray-400">() </span>
          <span className="text-orange-300">data</span>
          <span className="text-gray-400">) {"{"}</span>
        </div>
        <div className="pl-8">
          <span className="text-pink-400">return </span>
          <span className="text-gray-400">this.</span>
          <span className="text-purple-400">service</span>
          <span className="text-gray-400">.</span>
          <span className="text-purple-400">create</span>
          <span className="text-gray-400">(</span>
          <span className="text-orange-300">data</span>
          <span className="text-gray-400">);</span>
        </div>
        <div className="pl-4 text-gray-400">{"}"}</div>
        <div className="text-gray-400">{"}"}</div>
      </div>
    </div>
  );
}

function FloatingIcons() {
  const icons = [
    // Top area
    { Icon: AtSign, position: "top-[8%] left-[10%]", delay: "0s", duration: "6s", color: "text-purple-400" },
    { Icon: Shield, position: "top-[12%] right-[15%]", delay: "1s", duration: "7s", color: "text-cyan-400" },
    { Icon: Zap, position: "top-[20%] left-[20%]", delay: "0.5s", duration: "5s", color: "text-yellow-400" },

    // Left side
    { Icon: Database, position: "top-[35%] left-[5%]", delay: "2s", duration: "8s", color: "text-emerald-400" },
    { Icon: Globe, position: "top-[55%] left-[8%]", delay: "1.5s", duration: "6s", color: "text-blue-400" },
    { Icon: Layers, position: "top-[75%] left-[12%]", delay: "3s", duration: "7s", color: "text-pink-400" },

    // Right side
    { Icon: Lock, position: "top-[30%] right-[8%]", delay: "2.5s", duration: "6s", color: "text-orange-400" },
    { Icon: Code2, position: "top-[50%] right-[5%]", delay: "0.8s", duration: "7s", color: "text-violet-400" },
    { Icon: Key, position: "top-[70%] right-[10%]", delay: "1.2s", duration: "5s", color: "text-teal-400" },

    // Bottom area
    { Icon: Workflow, position: "bottom-[15%] left-[25%]", delay: "3.5s", duration: "8s", color: "text-indigo-400" },
    { Icon: Cookie, position: "bottom-[20%] right-[20%]", delay: "2.2s", duration: "6s", color: "text-amber-400" },
    { Icon: Server, position: "bottom-[10%] right-[35%]", delay: "1.8s", duration: "7s", color: "text-rose-400" },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-[5] hidden overflow-hidden md:block">
      {icons.map(({ Icon, position, delay, duration, color }, index) => (
        <div
          key={index}
          className={`absolute ${position} ${color} opacity-40`}
          style={{
            animation: `float ${duration} ease-in-out infinite`,
            animationDelay: delay,
          }}
        >
          <Icon className="h-6 w-6 lg:h-8 lg:w-8" />
        </div>
      ))}

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-15px) rotate(5deg);
          }
          50% {
            transform: translateY(-8px) rotate(-3deg);
          }
          75% {
            transform: translateY(-20px) rotate(3deg);
          }
        }
      `}</style>
    </div>
  );
}