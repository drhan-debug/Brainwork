# Bloom account service

The Vite React UI and Cloudflare Worker ship together. `npm run build` builds the UI, embeds its assets in `dist/server/index.js`, and copies schema migrations into `dist/migrations`. No external identity provider or secret is needed: account/session secrets are generated with Web Crypto and persisted as hashes in D1.

Local setup:

```sh
npm install
npm run build
npm run db:migrate
npm run dev
```

Open the Wrangler URL (normally http://localhost:8787); modern browsers permit Secure cookies on localhost. `npm run dev:ui` is the optional standalone Vite UI development server and does not provide the account API. Never use a remote database binding for local tests. Root `wrangler.jsonc` declares local D1 `DB`; Sites deployment declares its managed binding in `.openai/hosting.json`.

Passwords use audited `@noble/hashes` scrypt with N=32768,r=8,p=3, 16-byte random salts and 32-byte keys (about 32 MB working memory). Authentication requires a Worker CPU budget; generated Wrangler configuration allows 30 seconds. Sessions use 32 random bytes, stored only as SHA-256 digests, and expire after 30 days. Cookies are Secure/HttpOnly/SameSite=Lax. Recovery codes use 32 random bytes, stored only as digests; using one rotates it and revokes every previous session.

Email addresses are identifiers, not verified inbox ownership. There is no email service or email reset link. A user who loses both password and recovery code cannot recover this account through the application. Save the code shown after account creation/recovery.

The API enforces exact Origin checks, bounded JSON payloads, auth throttles (40 attempts/IP and 12/email per 15 minutes), ownership from sessions, and expected-account guards against stale tabs. Server errors deliberately omit request or credential logging. D1 is provisioned separately for local and hosted environments. Apply schema migrations before starting the service; request handlers never create tables.

Normal progress accepts typed operations, not replacement snapshots. Optimistic revisions and transactional operation IDs prevent lost or repeated writes across devices. All schedules use server time and account timezone. One explicit import is allowed before cloud learning begins; it never removes browser-local records. See [API.md](API.md) for the complete contract.
