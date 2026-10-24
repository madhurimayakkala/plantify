# Plantify

[![CI](https://github.com/madhurimayakkala/plantify/actions/workflows/ci.yml/badge.svg)](https://github.com/madhurimayakkala/plantify/actions/workflows/ci.yml)

Plantify turns finishing your work into growing a plant. You create a **workload** (a name plus a list of tasks), tick off progress, and your plant grows as you "water" it. When a cycle ends you can save the plant to your **garden**, keep going, or reset.

Live demo: https://plantify-ecru.vercel.app/

## Screenshots

<!-- Replace with real captures. Suggested: dashboard mid-cycle, End Cycle modal, garden page, and a short GIF of the guest flow. -->

_Screenshots and a demo GIF coming soon._

## How it works

- **Workload:** a named set of tasks. Each task has a `total` and a `completed` count (for example "Read chapters", 3 of 10).
- **Water:** the average completion percentage across all tasks, from 0 to 100. If you continue a finished cycle, the previous water is blended in with the new progress.
- **Plant stages:** water maps to a growth stage.

  | Water   | Stage     |
  | ------- | --------- |
  | 0-20%   | Seed      |
  | 21-40%  | Sprout    |
  | 41-60%  | Growing   |
  | 61-80%  | Blooming  |
  | 81-100% | Full tree |

- **End cycle:** save the plant to your garden and reset, continue with the carried-over water, or just reset.
- **Garden:** every saved cycle, with its stage, water percent and tasks completed.

## Features

- **Guest mode:** try the whole app without an account. Data lives in `localStorage` on your device.
- **Guest-to-account migration:** when a guest signs up or signs in, their local workload and garden are copied to their account. Local data is only cleared if every request succeeded, so a failed attempt can be retried safely. An existing account workload is never overwritten, and garden saves are idempotent (see below).
- **Optimistic UI with rollback:** task progress updates instantly and is saved with a short debounce. If the save fails, the UI rolls back to the last state that was actually persisted and shows a retry toast.
- **Edit workloads:** rename a workload, add, remove or edit tasks, and reorder them by drag and drop or with move up/down buttons. Lowering a task's total below its progress lowers the progress to fit, with a warning first. Works in guest and signed-in mode.
- **Zod validation:** every API request body is validated, with clear 400 errors for bad JSON or bad shapes.
- **Clerk auth:** sign in and sign up through Clerk; all API routes require a session.

## Tech stack

Versions are the ones in `package.json`.

| Area             | Tool                                                        |
| ---------------- | ----------------------------------------------------------- |
| Framework        | Next.js 16.2.9 (App Router), React 19.2.4                   |
| Language         | TypeScript ^5                                               |
| Styling          | Tailwind CSS ^4                                             |
| Auth             | Clerk (`@clerk/nextjs` ^7.5.7)                              |
| Database         | Supabase (`@supabase/supabase-js` ^2.108.2)                 |
| Validation       | Zod ^3.24.1                                                 |
| UI extras        | framer-motion ^12.40.0, sonner ^1.7.1, lucide-react ^1.21.0 |
| Unit tests       | Vitest ^2.1.8                                               |
| End-to-end tests | Playwright ^1.61.1                                          |
| Lint             | ESLint ^9 with `eslint-config-next` 16.2.9                  |
| Hosting          | Vercel                                                      |

## Architecture notes

**Row Level Security, enforced by the database.** Clerk handles sign-in and Supabase stores the data. Supabase is configured to trust Clerk as a third-party auth provider, so it can verify Clerk session tokens. Route handlers (`app/api/**`) create a per-request Supabase client (`lib/supabase-server.ts`) with the **anon** key and the signed-in user's Clerk token. Postgres reads the token's `sub` claim (the Clerk user id) and RLS policies on `active_workloads` and `garden_entries` only allow rows where `user_id` matches it. There is no service role key in the app; even a bug in a route handler can't read another user's rows. The policies live in `supabase/migrations/`, and `supabase/tests/rls_verification.sql` checks them.

**Defense in depth.** The app code still checks ownership itself, so a mistake in one layer isn't enough to leak data:

1. Every handler starts with `requireUser()` (`lib/api-auth.ts`), which reads the Clerk session and returns a 401 if nobody is signed in.
2. Every query is also filtered by that `userId` (`.eq("user_id", userId)`), including reads, deletes and the read-back after a garden save. The client never decides whose data it touches.

**Concurrent edits.** `PUT /api/workload` is a compare-and-swap: the client sends the `updated_at` it last saw and the server only writes if it still matches. Otherwise it returns 409 with the current workload, and the client shows a toast and switches to the server's copy. The first save for a user is create-only.

**Health check.** `GET /api/health` is public and calls a tiny SQL function (`public.health_check()`) that reads no tables, so it works under RLS and exposes no data. Use it for uptime and keep-alive pings.

**Idempotent garden saves.** The client generates a UUID for each garden entry. `POST /api/garden` upserts on that `id` with `ignoreDuplicates`, then reads the row back filtered by `user_id`. Retrying a half-finished guest migration therefore can't create duplicates, and an id that belongs to another user returns 409 instead of touching their row. If you're setting up your own Supabase project, see `supabase/garden_entries_client_id.sql` for the column requirements.

**Project layout.**

```
app/            Pages and API routes (app/api/workload, app/api/garden)
components/     UI components
hooks/          useWorkload: state, optimistic saves, guest/account switching
lib/            waterCalc, validation (Zod), guestStorage, migrateGuestData, auth and Supabase helpers
tests/          Playwright smoke test
legacy/         Original Flask prototype (reference only)
```

## Running locally

You need Node.js 20 or newer (CI uses 22), a Clerk application, and a Supabase project.

```bash
git clone https://github.com/madhurimayakkala/plantify.git
cd plantify
npm install
cp .env.example .env.local   # then fill in your own values
npm run dev
```

Open http://localhost:3000.

### Environment variables

Names only. Get the values from your Clerk and Supabase dashboards, and never commit `.env.local`.

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

The app expects two tables in Supabase: `active_workloads` (one row per user) and `garden_entries`. Full table definitions aren't checked into the repo yet. `supabase/migrations/` holds the changes made so far (workload concurrency, then RLS); run them in filename order. To use RLS you also need Clerk's Supabase integration enabled and Clerk added under Authentication > Sign In / Up > Third-Party Auth in the Supabase dashboard.

## Tests

```bash
npm run lint     # ESLint
npm test         # Vitest unit tests (water calculation, guest migration)
npm run build    # production build

# End-to-end smoke test: guest creates a workload, finishes it, saves it to the garden
npx playwright install chromium
npx playwright test tests/smoke.spec.ts --project=chromium
```

GitHub Actions (`.github/workflows/ci.yml`) runs lint, Vitest and the build on every push and pull request, using placeholder env vars. The Playwright smoke test also needs a working Clerk instance, because the app doesn't render until Clerk's script loads. To turn it on in CI, add two repository secrets from a Clerk development instance: `CLERK_PUBLISHABLE_KEY_TEST` and `CLERK_SECRET_KEY_TEST`. Without them that step is skipped and the run shows a notice.

## Future improvements

- A real migrations folder for the Supabase schema
- Component-level tests for the `useWorkload` hook

## Legacy prototype

The `legacy/` folder is the original Flask prototype of Plantify. It is kept for reference only and is not part of the Next.js app.
