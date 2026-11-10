# BuildPath Admin

Internal administration interface for BuildPath.

## Current scope

The console requires a separate staff account and reads the role-protected `GET /api/v1/admin/capabilities` endpoint. Staff can manage quality profile drafts and version history through a role-protected API. Customer accounts cannot sign in here. New review runs snapshot the global default profile version and report its rule-based quality gate. The gate does not block publication; operations and audit event browsing also remain planned.

## Local development

Requires Node.js 22.11+.

```sh
npm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1 npm run dev
```

Set `NEXT_PUBLIC_API_BASE_URL` to the BuildPath API. On the API, apply migrations and explicitly provision an initial staff account with `STAFF_INITIAL_EMAIL`, `STAFF_INITIAL_PASSWORD`, `STAFF_INITIAL_DISPLAY_NAME`, `STAFF_INITIAL_ROLE`, then run `npm run staff:create`. Never commit provisioning credentials. See builder-docs for product and security requirements.

## Production

`Dockerfile` builds a standalone Next.js server (`output: "standalone"`). The image calls the API on its own origin (`NEXT_PUBLIC_API_BASE_URL=/api/v1` by default); the reverse proxy routes `/api/*` to the API. Deployment for all services: `builder-back/deploy/README.md`.

Optional browser error reporting: set `NEXT_PUBLIC_SENTRY_DSN` at build time (Sentry or self-hosted GlitchTip). Events carry no cookies, headers, query strings or user data.

## Account deletion

The console sets how many days data of a deleted account is kept before it is purged (1–90) and can restore an account during that period. Both actions are super-admin only and written to the audit history.
