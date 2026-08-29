# Staging workflow

One-time setup, done once. Steps 6-7 are the actual day-to-day loop from
here on.

## 1. Staging Supabase project

Same staging Supabase project the backend repo's `STAGING.md` sets up -
this repo just needs its URL and anon key (step 4 below), it doesn't run
migrations itself.

## 2. `staging` branch

```
git checkout -b staging
git push -u origin staging
```
Do this once, in this original folder. `main` (production) is untouched.

## 3. Second local folder via git worktree

```
git worktree add ../tavzio-frontend-staging staging
```
Do the equivalent in the backend repo too (its own `STAGING.md` has the
exact command). This gives you a real, separate folder on disk, checked
out to `staging`, still the same underlying repo - open it in VS Code for
day-to-day work instead of this one.

## 4. `.env` in the staging folder

Copy `.env.staging.example` (in this repo) to `.env` inside
`tavzio-frontend-staging/`, and fill in real staging values - the same
staging Supabase project's URL/anon key the backend repo points at. Do
the same for the backend repo using its own `.env.staging.example`.

From this point on, running the app locally from the `-staging` folder
always hits staging infrastructure, regardless of git branch - this file
is gitignored and never changes on its own.

## 5. Vercel + Railway staging environments

**Vercel:** Project → Settings → Domains → add a staging domain (e.g.
`staging.tavzio.ae`) and assign it to the `staging` branch specifically.

**Railway:** Project → Settings → Environments → New Environment, name it
`staging`, set its env vars to the staging values from step 4, and set
its deploy branch to `staging`.

## 6. Day-to-day work (the actual loop)

Everything happens in the `-staging` folders:
```
cd tavzio-frontend-staging
# make changes
git add .
git commit -m "..."
git push
```
Vercel/Railway auto-deploy staging. Test on your staging domain against
the staging database - nothing here can touch a real customer.

## 7. Promoting to production

Once confirmed working on staging:
```
cd tavzio-frontend        # the ORIGINAL folder, on main
git pull origin main
git merge staging
git push
```
Same in the backend repo (see its own STAGING.md for the migration
step, which lives there). Vercel/Railway deploy `main` automatically.

Never copy files directly into this folder by hand - always let `git
pull`/`git merge` do it, so history stays accurate and any change is
reviewable and revertible.
