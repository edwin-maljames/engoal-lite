# Project Rules — Web (Next.js / React / TypeScript)

This file extends the global Alteeza Lab rules at `~/.claude/CLAUDE.md`.
Stack: **Next.js · React · TypeScript · Tailwind CSS**

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Framework | Next.js (App Router) |
| Language | TypeScript — strict mode, no `any` |
| Styling | Tailwind CSS |
| Unit + Integration tests | Vitest |
| API mocking (integration) | MSW (Mock Service Worker) |
| E2E tests | Playwright (CI only) |
| Linter | ESLint |
| Formatter | Prettier |
| Package manager | npm |

---

## Commands

```bash
npm run dev          # local dev server
npm run build        # production build — run this before pushing to catch type errors
npm run lint         # ESLint — fix all warnings before pushing
npm run test         # Vitest — unit + integration tests (must pass before push)
npm run test:e2e     # Playwright — run locally only when testing E2E flows manually
```

**Before every push, run in this order:**
```bash
npm run lint && npm run build && npm run test
```
All three must pass. Do not push if any fails.

---

## Testing Standards

### Unit tests (Vitest)
- Co-locate test files: `component.test.ts` next to `component.ts`
- Test every exported function and every React component with meaningful interactions
- Use `@testing-library/react` for component tests

### Integration tests (Vitest + MSW)
- Mock all external API calls with MSW handlers in `src/mocks/handlers.ts`
- Test full user flows within a page (form submit → API call → UI update)

### E2E tests (Playwright — CI only)
- Live in `tests/e2e/`
- Cover critical user journeys only (login, checkout, key CRUD flows)
- Do not run locally on every push — CI handles these

---

## Code Standards

- **TypeScript:** No `any`. Explicit return types on all exported functions.
- **Components:** Functional components only. No class components.
- **State:** Prefer React Query for server state, `useState`/`useReducer` for local state.
- **Imports:** Use path aliases (`@/components/...`) — never relative `../../` chains.
- **Env vars:** Access only via a validated config object — never `process.env.X` directly in components.
- **Secrets:** Never commit `.env.local` or any file containing `NEXT_PUBLIC_` secrets with real values.

---

## Project Setup (run once per new repo)

```bash
# Install dependencies
npm install

# Install Playwright browsers (first time only)
npx playwright install

# Copy PR template
mkdir -p .github && cp ~/dev/Alteeza/alteeza_lab/pr_template.md .github/pull_request_template.md

# Verify tests run
npm run test
```

