---
name: add-feature
description: Plan, build, test and run a new feature for this to-do app on its own branch, then commit, push and open a pull request. Use when the user asks to add a feature end to end.
argument-hint: <feature description>
disable-model-invocation: true
---

# add-feature

Ship one feature end to end: **plan, branch, build, test, commit, push, PR.** The feature is: $ARGUMENTS

If no feature was given, ask for one in a single line and stop.

Read `CLAUDE.md` first. It describes the architecture and the coupling you must not break (animations vs JSX, `run()`/`api()`, server validation).

## 1. Plan
- Work out which files change. Climb the ladder: reuse what exists, add the least code that works. No new dependency for something a few lines can do.
- If the feature adds or changes API endpoints, list them (method, path, body, status codes) and show them to the user **before coding**. Wait for a yes.
- For anything else, give a 3-5 line plan and continue unless the user objects.

## 2. Branch
- Check `git status`. If there are uncommitted changes that aren't part of this feature, stop and ask what to do with them; never fold unrelated work into the feature commit.
- Base branch is `main` unless the user names another. Confirm it shares history with your work: `git fetch origin main && git merge-base HEAD origin/main`. If there is no common history, stop and tell the user.
- Create `feature/<short-kebab-name>` from the base. Never commit to `main` or `master`.

## 3. Build
- Edit only what the feature needs. Match the surrounding code's style and comment density.
- Keep `server/index.js` validating input, and keep every UI call going through `run()` so failures show the banner.
- Update `README.md` (features, API table) and `CLAUDE.md` when behavior or architecture changes. Don't pad them.

## 4. Test and run
There is no test suite or linter, so verify for real:
1. `npm run build` must succeed.
2. **Never test against the user's real data.** Run a scratch API: `DATA_DIR=$(mktemp -d) node server/index.js` (port 3001, which the Vite proxy expects). First check nothing already listens on 3001; if the user's own server does, ask before stopping it.
3. Exercise API changes with `curl`: success, each validation failure, and `404` cases.
4. Run the app (`npm run dev`, or the existing dev server on 5173) and use the feature in the browser pane: the happy path, an error path, and a page reload. Check the console for errors.
5. Stop anything you started and delete the scratch data. Confirm `server/data/tasks.json` is unchanged.

Report anything you could not verify (for example screenshots that timed out). Do not claim a check passed that you did not run.

## 5. Commit and push
- Stage files by name (not `git add -A`) and never stage `server/data/`, `dist/` or `.claude/settings.local.json`.
- One commit with a message that says what changed and why. End it with the attribution line from the session's system reminder, if there is one.
- `git push -u origin <branch>`. If the connection times out, retry once before reporting a failure.

## 6. Pull request
- If `gh` is installed and logged in: `gh pr create --base <base> --title ... --body ...` (not a draft). The body covers what changed, why, how it was tested, and anything a reviewer should know. Print the PR URL.
- If `gh` is missing (it is not installed on this machine by default), do not stop at "can't": give the compare link `https://github.com/daviangodwin6-art/cluade_practise/compare/<base>...<branch>?expand=1` plus a ready-to-paste title and description.

## Finish
End with: the branch name, the commit, the PR link (or compare link), what was verified, and what was not.
