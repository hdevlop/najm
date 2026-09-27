# Changelog

## Unreleased (minor, requires najm-core with `createParamDecorator`)

- feat(params): tool calls resolve `createParamDecorator` parameters after
  their guards, inside that call only. `query()` and `param()` read the tool's
  validated input, `header()` the transport request. Tool calls of one message
  share a request store, so the value is never kept there.
- fix(params): controller arguments are resolved asynchronously; previously a
  custom parameter was always `undefined` in a tool call.

## 2.1.2 - 2026-09-05

- fix(peer): declare compatibility with `najm-auth` 4 while retaining the
  supported 3.x range

## 2.1.1 - 2026-09-03

- feat(auth): add `auth: { type: 'najm-auth' }` to protect the complete MCP
  HTTP surface with the installed Najm bearer-token resolver
- security(errors): make unexpected, internal, and forbidden tool errors
  opaque by default, with explicit `exposeErrorDetails` diagnostics for trusted
  development environments
