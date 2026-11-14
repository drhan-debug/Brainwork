# Local fullscreen save regression checks

Install the application dependencies and this harness, then run:

```sh
npm ci --cache /tmp/bloom-npm-cache
npm ci --prefix tests-local --cache /tmp/bloom-npm-cache
npm test --prefix tests-local
```

The harness bundles the real application entry into `.generated/`, mounts it with ReactDOM in jsdom, completes a full English sentence session using DOM events, and verifies:

- Account save fails, exposes a retry inside the active portal dialog, and succeeds with the same operation ID. Double retry while the request is pending sends one request.
- Local demo storage fails, exposes the same accessible retry, and saves one completion without changing the other learner.
- Background remains inert, the retry accepts focus, Tab and Shift+Tab stay in the dialog, and closing restores background interaction.
- Retry disappears after success; five sentence records and exactly one completed session remain.

Account fetch responses and storage quota errors are controlled fixtures. jsdom has no layout engine or native inert behavior; geometry and inert reflection are stubbed to exercise the application's focus logic. These checks do not replace visual browser coverage, real mobile touch/scroll testing, or server integration tests. All generated bundles and dependencies are ignored by this directory's `.gitignore`.

Verified against baseline commit `870be8d`: both scenarios fail because the retry button is absent from the active portal. Both scenarios pass with the fullscreen save-status fix.
