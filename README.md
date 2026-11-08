# BuildPath Admin

Internal administration interface for BuildPath.

## Current scope

The console includes a read-only capability catalog loaded from the backend versioned GET /api/v1/capabilities manifest. It separates supported, limited, documentation-only, and unavailable product flows. No project data or control actions are exposed; quality profile editing and operations/audit remain planned until staff authentication, authorization, and audit APIs are implemented.

## Local development

Requires Node.js 22.11+.

```sh
npm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1 npm run dev
```

Set NEXT_PUBLIC_API_BASE_URL to the BuildPath API. See builder-docs for product and security requirements.
