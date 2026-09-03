# Changelog

## 2.1.1 - 2026-09-03

- feat(auth): add `auth: { type: 'najm-auth' }` to protect the complete MCP
  HTTP surface with the installed Najm bearer-token resolver
- security(errors): make unexpected, internal, and forbidden tool errors
  opaque by default, with explicit `exposeErrorDetails` diagnostics for trusted
  development environments
