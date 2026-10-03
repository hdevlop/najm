# Published-package consumer auth acceptance

Run from the Najm root after publishing and installing the compatible packages
in sibling Kafil and School checkouts:

```powershell
bun packages/najm-auth/integration/consumer-acceptance/run.ts kafil
bun packages/najm-auth/integration/consumer-acceptance/run.ts school
```

The default infrastructure is PostgreSQL on `127.0.0.1:55432` (admin database
`postgres`, local user `postgres`) and Redis on `127.0.0.1:56379`.
`NAJM_AUTH_REAL_POSTGRES_URL` and `NAJM_AUTH_REAL_REDIS_URL` can override them;
both endpoints must be loopback. This runner does not start infrastructure.

Each invocation creates and drops its own uniquely named PostgreSQL database,
sets test-only secrets and memory email in the child process, and uses the
consumer's installed packages, actual auth factory, and PostgreSQL driver.
It never loads the application's env file or application database. The auth
schema fixture contains only the tables these journeys need.

The runner temporarily places its test harness in the consumer's server test
folder to use that checkout's normal package resolution and TypeScript settings.
It removes that exact generated file when the child exits. No Najm package
source is linked or copied into the consumer.

Assertions cover login, refresh, reset consumption/replay, prior bearer
revocation, invitation activation, first-login password setup/replay, and
caller-owned pool usability after server shutdown. Each invocation uses a new
client address to avoid sharing its rate-limit buckets with a prior invocation.

These are real auth HTTP-handler and database checks through `server.fetch()`;
they do not prove browser navigation, SMTP delivery, app-specific access-reset
commands, production database state, or deployment.
