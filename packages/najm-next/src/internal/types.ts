import type { NextConfig } from 'next';

export type NajmNextConfigOverrides = NextConfig;
export type EnvRecord = Readonly<Record<string, string | undefined>>;
export type HeaderRule = Awaited<ReturnType<NonNullable<NextConfig['headers']>>>[number];
export type { NextConfig };
