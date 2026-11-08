# BuildPath Admin

Internal administration interface for BuildPath.

## Current scope

The console requires a separate staff account and reads the role-protected `GET /api/v1/admin/capabilities` endpoint. Staff sessions use an HTTP-only cookie; customer accounts cannot sign in here. Quality profile editing and operations/audit views are not available yet.

## Local development

Requires Node.js 22.11+.

```sh
npm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1 npm run dev
```

Set `NEXT_PUBLIC_API_BASE_URL` to the BuildPath API. On the API, apply migrations and explicitly provision an initial staff account with `STAFF_INITIAL_EMAIL`, `STAFF_INITIAL_PASSWORD`, `STAFF_INITIAL_DISPLAY_NAME`, `STAFF_INITIAL_ROLE`, then run `npm run staff:create`. Never commit provisioning credentials. See builder-docs for product and security requirements.
