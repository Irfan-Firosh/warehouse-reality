# Using Beads for task tracking

Beads (`bd`) is where task **status** lives for the hackathon build. `docs/feature-split.md` says who owns what, and `docs/superpowers/plans/2026-10-27-hackathon-final.md` holds each task's files, signatures and tests. Neither file tracks status: only Beads does.

Issue prefix `ws`. Person A's epic is `ws-vee`, Person B's is `ws-2ab`. Labels: `lane-a`, `lane-b`, `p0` (must ship), `p1` (should ship).

## One-time setup

1. Install: `brew install beads` (tested with bd 1.3.1).
2. Get the code: `git fetch && git checkout docs/hackathon-final-plan` (or `main` once it's merged).
3. Pull the issues: `bd bootstrap`. It finds the Beads data stored in the GitHub repo and clones it. Your SSH access to the repo is all it needs.
4. Check it worked: `bd status` should show 22 issues, and `bd ready` should list work.

## Daily loop

| When | Command | Why |
|---|---|---|
| Start of a session | `bd dolt pull` | Get the other person's claims and closes |
| Pick work | `bd ready -l lane-a` (or `lane-b`) | Your lane's tasks with nothing blocking them |
| Read the task | `bd show ws-vee.3` | Description, dependencies, plan task number |
| Start it | `bd update ws-vee.3 --claim` | Assigns you and sets it in progress, so nobody else grabs it |
| Leave a note | `bd note ws-vee.3 "seed done, tests next"` | Context for the other person or the next session |
| Finish it | `bd close ws-vee.3 -r "merged in <commit>"` | Do this only after the commit is on `main` |
| After every claim or close | `bd dolt push` | Shares your change. Without it, the other person sees stale state |
| Abandon a task | `bd unclaim ws-vee.3` | Puts it back to open for anyone |

Closing a task automatically unblocks whatever depends on it. Run `bd ready` again after a pull to see newly unblocked work.

## Useful views

- `bd ready`: everything unblocked, both lanes.
- `bd blocked`: what's waiting, and on what.
- `bd dep tree ws-2ab.5`: the dependency chain for one task.
- `bd list --status in_progress`: who is working on what right now.
- `bd children ws-vee`: every task in Person A's lane.

## Rules

1. **Claim before you start.** Never work on a task someone else has claimed.
2. **Close only when it's on `main`**, with the commit in the close reason. Done means `pnpm check` passes and the plan task's tests are in.
3. **Push after every claim and close.** Pull at the start of every session.
4. **Status lives only in Beads.** Don't tick the checkboxes in the plan file, and don't keep a separate list.
5. **New work found mid-task gets its own bead**, not scope creep inside the current one: `bd create "Title" -t task -p 1 -l lane-a --parent ws-vee`. If it blocks something, add `--deps blocks:<id>`.
6. **Don't change dependencies to unblock yourself.** If a dependency is wrong, agree on it with the other person first.
7. **If Beads causes friction by Wednesday, stop using it.** Track status with the list in `docs/feature-split.md` instead. Nothing in the build depends on Beads.

## Using it with Claude Code

Ask your agent to run `bd ready -l <your lane>`, claim the top task, implement it from the plan task named in its description, then close it and run `bd dolt push`. Each bead description names its plan task (for example "Plan A6"), so the agent can find the files, signatures and tests.

## Optional: mirror to GitHub Issues

Beads can also mirror the issues to the repo's GitHub Issues tab:

1. Put `GITHUB_TOKEN=<fine-grained token with Issues read/write on this repo>` in `.env`. It's gitignored; never commit it.
2. Preview: `set -a; . ./.env; set +a; bd github sync --push-only --dry-run`.
3. Push: the same command without `--dry-run`.

Even with the mirror, Beads stays the source of truth.

## Troubleshooting

- **`bd ready` shows nothing for your lane:** run `bd dolt pull` first, then `bd blocked -l lane-a` to see what you're waiting on.
- **Push rejected:** `bd dolt pull`, then `bd dolt push` again.
- **Anything else:** run `bd doctor`.
