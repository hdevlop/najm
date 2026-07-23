/**
 * AutoReplyMatcher — compiles regex rules with RE2's linear-time engine and
 * caches compiled matchers per instance. The native JavaScript regex engine
 * is unsafe under catastrophic backtracking, so all `regex` rules MUST go
 * through this matcher. Exact and prefix matchers stay on plain strings.
 *
 * RE2 syntax is a subset of PCRE: no backreferences, no look-around, no
 * backtracking constructs. The compile step rejects unsupported patterns
 * with a clear error so a misconfigured rule never blocks the event loop.
 */
import { RE2JS } from 're2js';

const TEXT_CAP = 4_096;

export type CompiledMatcher =
  | { kind: 'exact'; pattern: string; lower: string }
  | { kind: 'prefix'; pattern: string; lower: string }
  | { kind: 'regex'; re: RE2JS; source: string; flags: string };

export interface MatcherInput {
  pattern: string;
  matchType: 'exact' | 'prefix' | 'regex';
}

export interface CompiledRule {
  id: string;
  enabled: boolean;
  response: string;
  matcher: CompiledMatcher;
}

export class AutoReplyMatcher {
  /**
   * Compile a single rule. Throws when the pattern is invalid or unsupported
   * so callers can reject bad input at create/update time.
   */
  static compile(rule: MatcherInput): CompiledMatcher {
    const p = rule.pattern;
    if (!p) throw new Error('Empty pattern');
    if (rule.matchType === 'exact') {
      return { kind: 'exact', pattern: p, lower: p.trim().toLowerCase() };
    }
    if (rule.matchType === 'prefix') {
      return { kind: 'prefix', pattern: p, lower: p.trim().toLowerCase() };
    }
    if (rule.matchType === 'regex') {
      try {
        const re = RE2JS.compile(p, RE2JS.CASE_INSENSITIVE);
        return { kind: 'regex', re, source: p, flags: 'i' };
      } catch (err: any) {
        throw new Error(`Invalid regex pattern: ${err?.message ?? err}`);
      }
    }
    throw new Error(`Unsupported matchType: ${rule.matchType}`);
  }

  /**
   * Test a single matcher against the inbound text. The text is truncated to
   * a small cap and lowercased once.
   */
  static test(matcher: CompiledMatcher, text: string): boolean {
    const safe = (text ?? '').slice(0, TEXT_CAP).trim();
    if (!safe) return false;
    if (matcher.kind === 'exact' || matcher.kind === 'prefix') {
      const lower = safe.toLowerCase();
      return matcher.kind === 'exact'
        ? lower === matcher.lower
        : lower.startsWith(matcher.lower);
    }
    try {
      return matcher.re.test(safe);
    } catch {
      return false;
    }
  }

  /**
   * Validate a pattern without producing a compiled matcher. Useful for
   * create/update validation before persistence.
   */
  static validate(pattern: string, matchType: 'exact' | 'prefix' | 'regex'): void {
    if (!pattern) throw new Error('pattern is required');
    if (matchType === 'regex') {
      try { RE2JS.compile(pattern, RE2JS.CASE_INSENSITIVE); }
      catch (err: any) {
        throw new Error(`Invalid regex pattern: ${err?.message ?? err}`);
      }
    }
  }
}
