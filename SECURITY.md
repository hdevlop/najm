# Security Policy

## Supported Versions

Security fixes are issued for the current Najm major release line.

| Version | Supported |
| --- | --- |
| 2.x | Yes |
| < 2.0 | No |

## Reporting A Vulnerability

Please do not open a public issue for a suspected vulnerability.

Report privately through GitHub private vulnerability reporting on the Najm
repository with:

- affected package and version
- a short proof of concept or reproduction steps
- expected impact
- any known mitigations

You should receive an acknowledgement within 72 hours. Confirmed issues will be
triaged privately, fixed on a security branch, and disclosed after a patched
release is available.

## Security Defaults

Najm's launch line treats authentication, CORS, cookies, rate limits, storage,
and MCP tool exposure as security-sensitive surfaces. Defaults should fail
closed where practical, and any public route or unauthenticated tool exposure
must be explicit in package docs.
