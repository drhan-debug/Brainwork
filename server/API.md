# Bloom native account API

All responses are JSON, `Cache-Control: no-store`. Send JSON and a same-origin `Origin` header for every mutation; browsers supply Origin for fetch. Cookie is opaque HttpOnly Secure SameSite=Lax, 30-day expiry. No ChatGPT identity dependency. Password 12–128 characters (512-byte cap). Email is case-insensitive. Email delivery and email verification are not configured; recovery uses a one-time random code shown at registration and after recovery.

## State

`GET /api/session` returns `{authenticated:false}` or the state object below. Every successful mutation except logout returns the authenticated state. Register/recover also return `recoveryCode` once. Logout returns `{authenticated:false}`.

```
{
 authenticated: true,
 account: {id, email},
 profile: {name, language: 'en'|'ja', goal: 10, timezone: 'Asia/Seoul'},
 learner: {learned:[], reviews:{}, reviewStages:{}, sessions:0, minutes:0,
           name, goal, dates:[], dailyMinutes:{}, sentenceProgress:{}},
 revision: 0,
 imports: [{source:'wife'|'husband'|'legacy', importedAt:1710000000000}]
}
```

## Authentication

- `POST /api/auth/register`: `{email,password,name,language,goal?,timezone?}`. Name 1–60 chars, goal integer 1–120. Any Intl-valid IANA timezone accepted. Defaults 10/Asia/Seoul.
- `POST /api/auth/login`: `{email,password}`.
- `POST /api/auth/logout`: `{expectedAccountId}`.
- `POST /api/auth/recover`: `{email,recoveryCode,newPassword}`. Invalidates every prior session and rotates recovery code; establishes a new session.

## Account mutations

`PATCH /api/profile`: `{expectedAccountId,revision,profile:{name,language,goal,timezone}}`. Full profile required. Language locked after any activity or import.

`POST /api/progress`: Every operation has `{expectedAccountId,operationId,revision,type,...}`. operationId is a unique UUID or 16–100 character random identifier. Preserve it on retries. Server determines timestamps and scheduling in account timezone.

- `type:'sentenceSession'`: `results:[{sentenceId:'en:cafe_order:1',passed:true},...], elapsedMs`. 1–240 attempts, sentences from account language only. Duplicate attempts are combined: any failure wins. Increments completed sessions and time once.
- `type:'wordAnswer'`: `wordKey,known:<boolean>,completed:<boolean>,elapsedMs`. Exact existing vocabulary key. Only completed=true increments sessions/time. Word schedule matches legacy UI (failed 10m; successful 1/3/7/14/30 days; early practice preserves due date).
- `type:'dialogueSession'`: `elapsedMs`. Records one completed session/time.

All durations must be finite 0–7200000 milliseconds. Sentence success intervals are 3/7/14/30/60 account-local calendar days; failure is next account-local midnight. Early success preserves due date.

`POST /api/import`: `{expectedAccountId,operationId,revision,source:'wife'|'husband'|'legacy',learner:<one existing learner>}`. Explicit choice required, wife/legacy=en, husband=ja; must match account language. Exactly one import per account, only before cloud activity. Profile name/goal remain authoritative. Original local keys are untouched. Imports do not accept identity, owner, or arbitrary profile fields.

Authenticated mutations require `expectedAccountId` captured from the UI account. It must match the cookie owner; ownership always comes from the session. An account switch yields `ACCOUNT_CHANGED` (409) with no other account data. Do not retry that action under another account.

## Errors and concurrency

Error bodies `{code,error}`; revision conflicts also `{state:<current authenticated state>}`. 400 invalid input, 401 auth/recovery failure, 403 cross-origin, 404 unknown route, 405 wrong method, 409 email exists/revision conflict/import already used/language locked/operation reused with different data, 413 payload too large, 415 non-JSON, 429 auth throttled, 503 storage not configured.

Progress/import use atomic revision checks plus idempotency records. On `REVISION_CONFLICT`, replace the current snapshot with `state`, then replay the same semantic operation with its original operationId and the new revision. A replay of an applied operation returns the CURRENT state without applying again. Same operationId with different payload (excluding revision) yields `OPERATION_REUSED`. Profile edits can explicitly retry against the returned revision. Never submit a full learner snapshot for normal progress.


## Feedback

- `POST /api/feedback`: signed-in account plus same-origin JSON, `expectedAccountId`, `submissionId` (16–100 URL-safe characters), `category` (`bug|content|suggestion`), `message` (1–2000 characters), `language` (`en|ja|es|it`), optional `scenarioId` (valid shared ID or null), optional `page` (up to 100 characters). Returns `{id,saved:true}`. Ten new submissions per account per rolling 24 hours; duplicate IDs return the existing record, changed payloads return 409. Feedback does not mutate learner revisions.
- `GET /api/feedback`: only this account's latest 25 feedback messages. Optional `before=<positive integer id>` cursor and `status=new|planned|shipped`. Returns `{items,nextCursor,canReview}`. No author emails are included.
- `GET /api/feedback/inbox`: same pagination, but includes all accounts and `authorEmail`. Requires session account ID equal to server-only `FEEDBACK_ADMIN_ACCOUNT_ID`; otherwise 403.
- `PATCH /api/feedback/status`: admin only, same origin and expected account, `{feedbackId,status}` with `new|planned|shipped`. Returns updated ID/status. No public role-assignment endpoint exists.

Deployment owner must confirm the actual Bloom account and configure its immutable ID. Unverified email identifiers never grant admin access. There is no email delivery integration in this feature.

Curriculum now accepts thirty shared scenario IDs for each of `en`, `ja`, `es`, `it`; existing IDs are retained. Legacy word operations remain available only for English/Japanese.
