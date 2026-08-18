# FieldFlow: Git & GitHub Team Guide

For a four-person student team. Keep `main` presentation-ready. Do all work on a branch, then use a pull request (PR) to add it to `main`.

## 1. Team agreement (make this your rulebook)

1. No one codes or pushes directly to `main`.
2. One person owns each feature at a time. Tell the team before changing shared files such as `README.md`, `package.json`, database schema files, or app configuration.
3. Every change goes through a PR and at least one teammate looks at it before merging.
4. Pull the latest `main` before beginning work and before opening a PR.
5. Never commit passwords, API keys, `.env` files, or `node_modules`.
6. Do not use `git push --force`, `git reset --hard`, or `git clean -fd` on shared work unless an experienced teammate has confirmed the exact command and its impact. These can discard work.

Suggested ownership:

| Person | Area | Example branch |
|---|---|---|
| 1 | Scheduling | `feature/scheduling` |
| 2 | Operations dashboard | `feature/ops-dashboard` |
| 3 | Chatbot | `feature/chatbot` |
| 4 | Analytics | `feature/analytics` |

## 2. One-time setup

### Create the GitHub repository

1. One teammate creates the `fieldflow` repository on GitHub.
2. Add the other three as collaborators: **Settings → Collaborators**.
3. Add a README and a `.gitignore` suited to your technology (for example, Node).
4. In **Settings → Branches**, protect `main` if your GitHub plan allows it:
   - Require a pull request before merging.
   - Require one approval.
   - Do not allow force pushes.

### Each teammate installs and identifies Git

Install Git and VS Code, then run this once with your own details:

```bash
git config --global user.name "Your Name"
git config --global user.email "your-school-email@example.com"
git --version
```

### Clone the shared project

Copy the repository URL from GitHub, then run:

```bash
git clone https://github.com/your-team/fieldflow.git
cd fieldflow
git status
git branch
```

You should see `* main`. The star means “the branch I am currently on.”

## 3. The safe daily workflow

Use this routine every time.

### A. Start from an up-to-date `main`

```bash
git switch main
git pull origin main
```

If Git says you have uncommitted changes, see [Uncommitted changes when switching branches](#uncommitted-changes-when-switching-branches).

### B. Create a focused branch

Use a name that says what you are doing:

```bash
git switch -c feature/add-job-form
```

Check your location:

```bash
git status
```

It should say `On branch feature/add-job-form`.

### C. Work, inspect, and save a checkpoint

Before committing, inspect exactly what changed:

```bash
git status
git diff
```

Stage only the files you mean to include, then commit:

```bash
git add src/components/JobForm.jsx
git commit -m "Add job creation form"
```

Avoid `git add .` until you are comfortable reading `git status`; it can include files you did not intend to commit.

### D. Push your branch

```bash
git push -u origin feature/add-job-form
```

The `-u` is needed only the first time for that branch. Later, use `git push`.

### E. Open and merge a pull request

1. On GitHub, choose **Compare & pull request**.
2. Set the base branch to `main` and compare branch to your feature branch.
3. Use a clear title, such as **Add job creation form**.
4. Describe what changed, how to test it, and anything a reviewer should know.
5. Ask one teammate to review. Fix feedback by committing and pushing again; the PR updates automatically.
6. When checks pass and the reviewer approves, merge the PR. Use the normal merge button. Delete the remote branch afterward if GitHub offers it.

After your PR is merged, update locally:

```bash
git switch main
git pull origin main
git branch -d feature/add-job-form
```

The final command deletes only your *local* branch after it has been merged. If Git refuses, do not add `-D` until you understand why.

## 4. Updating your branch before a PR

If `main` changed while you worked, bring those changes into your branch:

```bash
git switch feature/add-job-form
git fetch origin
git merge origin/main
```

Then test the app, resolve any conflicts, commit the resolution if Git asks, and push:

```bash
git push
```

For this team, use **merge**, not rebase, when updating a shared or already-pushed branch. It is easier to recover from and does not rewrite history.

### Merge vs. rebase, in plain language

- **Merge** combines history and may create a “merge commit.” It is the safe default for beginners.
- **Rebase** replays your commits on top of newer work. It creates tidier history but changes commit IDs. It often requires a force push if the branch was already pushed.
- Team rule: use merge. Only rebase a private, unshared branch if someone who understands it tells you to.

## 5. First response to almost any problem

Stop before trying random commands. Run:

```bash
git status
git branch --show-current
git log --oneline -5
```

Read the output. Do not delete the folder, re-clone, force-push, or reset just because Git looks confusing. Your work is often still recoverable.

## 6. Errors and fixes in one place

### "I accidentally worked on main"

**If you have not committed yet:** create a branch immediately. Your changes come with you.

```bash
git switch -c feature/my-work
git status
```

Then commit and push as usual. `main` remains unchanged.

**If you committed locally on `main` but did not push:** save the commit on a branch, then return `main` to its remote version.

```bash
git branch feature/my-work
git switch main
git fetch origin
git reset --hard origin/main
```

Warning: `git reset --hard` discards uncommitted changes on `main`. Use it only after confirming your work is safely in `feature/my-work` and `git status` is clean.

**If you pushed to `main`:** tell the team. Do not rewrite shared history. Make a PR for future changes; if the pushed code must be reversed, use a revert (see [Undoing a commit safely](#undoing-a-commit-safely)).

### "Your local changes would be overwritten by switch" / cannot switch branches

You have changes that are not committed. Choose one:

**Keep them as a checkpoint (best choice):**

```bash
git add path/to/file
git commit -m "WIP: save progress before switching branches"
git switch other-branch
```

**Temporarily put them aside:**

```bash
git stash push -m "WIP before switching branches"
git switch other-branch
```

Bring them back later on the correct branch:

```bash
git switch feature/my-work
git stash pop
```

`stash pop` can conflict, so do it only on the branch where the work belongs. Never use `git checkout -f` to silence this warning; it can lose changes.

### "rejected" / "non-fast-forward" when pushing

Someone pushed new commits to the same remote branch. First, save your current work, then update your branch:

```bash
git status
git pull --no-rebase origin feature/add-job-form
```

Resolve conflicts if Git reports any, test, then:

```bash
git push
```

If this is a personal feature branch and you expected nobody else to edit it, check the branch name and ask the team before proceeding. Do not use `git push --force` as a shortcut.

### Merge conflict

A conflict means Git found competing edits it cannot safely choose between. It is not a disaster.

1. Run `git status` to list conflicted files.
2. Open each file. Look for markers like:

```text
<<<<<<< HEAD
your version
=======
incoming version
>>>>>>> origin/main
```

3. Decide the correct final content, often combining both versions.
4. Delete every marker line.
5. Save the file, test the app, then mark it resolved:

```bash
git add path/to/resolved-file
git commit
git push
```

**In VS Code:** open **Source Control**. Click a conflicted file, then use the choices above each block: **Accept Current**, **Accept Incoming**, **Accept Both**, or **Compare Changes**. Inspect the result before saving. Finish by staging, committing, and pushing.

**In a GitHub PR:** if GitHub offers **Resolve conflicts**, edit only simple text conflicts in the web editor, mark resolved, and commit the merge. For code or multiple files, resolve locally in VS Code so you can run the app first.

**Abort if you are unsure:**

```bash
git merge --abort
```

This returns to the state before the merge attempt; it does not delete committed work.

### "You are in detached HEAD state"

You checked out a specific commit instead of a branch. Do not start normal work there.

If you have no work to keep:

```bash
git switch main
```

If you made useful changes or commits there, save them to a branch:

```bash
git switch -c feature/recover-detached-work
git push -u origin feature/recover-detached-work
```

Then open a PR normally.

### "Divergent branches" when pulling

Your local branch and the remote branch each have commits the other does not. For beginners, explicitly merge:

```bash
git pull --no-rebase origin feature/add-job-form
```

Resolve any conflicts, test, and push. If this appears on `main`, stop and ask the team: normally nobody should commit locally to `main`.

### A file was deleted accidentally

**Deletion is not committed:** restore it from the last commit:

```bash
git restore path/to/file
```

**Deletion is in the latest local commit and not pushed:** restore the file from the previous commit, then amend:

```bash
git restore --source=HEAD~1 -- path/to/file
git add path/to/file
git commit --amend --no-edit
```

**Deletion is already pushed or merged:** restore it in a new branch/PR. Find a commit where it existed (`git log -- path/to/file`), then:

```bash
git restore --source=<good-commit-id> -- path/to/file
git add path/to/file
git commit -m "Restore deleted file"
git push
```

### Undoing a commit safely

For a commit already pushed to a shared branch, create a new commit that reverses it:

```bash
git revert <commit-id>
git push
```

This is safe because it preserves history. Use GitHub’s **Revert** button for a merged PR when available.

For a local, unpushed commit, you may undo the commit but keep its file changes:

```bash
git reset --soft HEAD~1
```

Do not use `git reset --hard HEAD~1` unless you want to permanently discard the commit’s changes and have checked the target. It is destructive.

### `.gitignore` does not seem to work

`.gitignore` prevents *new, untracked* files from being added. It does not stop tracking a file that was committed before.

Add rules such as:

```gitignore
node_modules/
.env
.env.*
dist/
build/
```

To stop tracking an already-committed file while keeping it on your computer:

```bash
git rm --cached .env
git commit -m "Stop tracking environment file"
git push
```

For a directory:

```bash
git rm -r --cached node_modules
git commit -m "Stop tracking node_modules"
git push
```

Check a rule with:

```bash
git check-ignore -v .env
```

### `node_modules` was committed

1. Add `node_modules/` to `.gitignore`.
2. Remove it from Git’s index, not from your computer:

```bash
git rm -r --cached node_modules
git add .gitignore
git commit -m "Remove node_modules from repository"
git push
```

3. Keep `package.json` and the team’s lock file (`package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock`) committed. Teammates should run:

```bash
npm install
```

If the repository became very large, ask before rewriting history. Removing it from the latest version does not remove it from old Git history.

### A secret or API key was committed

Treat it as exposed even if the repository is private.

1. **Immediately revoke or rotate the key** in the provider’s dashboard. This is the crucial step.
2. Remove it from tracked files; put the key in a local `.env` file and add `.env` to `.gitignore`.
3. Commit and push the removal.
4. Tell the team to update their local `.env` values.
5. Tell the instructor or repository owner if required by your course.

Do not paste a real key into chat, an issue, or a PR. History cleanup may also be needed, but rotating the key comes first. Do not attempt history rewriting without team agreement.

### It works on my computer but not a teammate’s

Use one documented setup:

```bash
node --version
npm --version
npm install
npm run dev
```

Commit the manifest and exactly one lock file. Agree on a Node version (put it in `README.md` or `.nvmrc`). When dependencies change, commit both `package.json` and its lock file. Do not commit `node_modules`.

If a teammate gets errors after pulling, they can usually run:

```bash
npm install
```

Then restart the app. If it persists, compare Node versions and read the first meaningful error, not the last cascade of errors.

### Backend/API or database schema mismatch

This happens when frontend, backend, or database changes are merged in a different order.

Before changing an API or schema:

1. Write down the field names, types, and example request/response in `docs/data-model.md`.
2. Coordinate who changes backend, frontend, migration, and sample data.
3. Include the migration/schema change and app change in the same PR when practical.
4. Test a fresh setup and a realistic request before merging.

When it breaks, compare the request payload, API response, schema/migration version, and environment variables. Check spelling and types first: `jobId` vs `job_id`, string vs number, nullable vs required.

## 7. Useful commands, without surprises

| Need | Command | What it does |
|---|---|---|
| See branch and changes | `git status` | Safe first check |
| See changed lines | `git diff` | Shows unstaged edits |
| See recent commits | `git log --oneline -5` | Short history |
| Change branch | `git switch branch-name` | Moves to a branch |
| Create/switch branch | `git switch -c branch-name` | Starts a new branch |
| Update `main` | `git pull origin main` | Downloads and merges changes |
| Save changes | `git add file` then `git commit -m "message"` | Makes a checkpoint |
| Publish branch | `git push -u origin branch-name` | Sends it to GitHub |
| Restore uncommitted file | `git restore file` | Discards edits in that file |
| Safely reverse published commit | `git revert commit-id` | Adds an opposite commit |

## 8. Final troubleshooting decision tree

```text
Something went wrong
│
├─ Do I have uncommitted work? → Run: git status
│  ├─ Yes → Commit it, or stash it before changing branches/pulling
│  └─ No → continue
│
├─ Am I on the right branch? → Run: git branch --show-current
│  ├─ No → git switch correct-branch
│  └─ Yes → continue
│
├─ Did a pull/merge report conflicts?
│  ├─ Yes → Resolve files, git add, git commit, test, git push
│  └─ No → continue
│
├─ Was my push rejected?
│  ├─ Yes → git pull --no-rebase origin current-branch; resolve/test/push
│  └─ No → continue
│
├─ Did I delete or undo something?
│  ├─ Not committed → git restore path/to/file
│  ├─ Pushed/shared → restore/revert in a new commit or PR
│  └─ Unsure → stop and ask; do not run reset --hard
│
├─ Is a secret exposed?
│  └─ Rotate/revoke it first, then remove it and notify the team
│
└─ Does the app fail after pulling?
   ├─ Run the documented dependency install command
   ├─ Check Node/version and `.env` setup
   └─ Compare API/schema changes with the team
```

## 9. Before you ask for help, send this information

Paste the exact error and the results of:

```bash
git status
git branch --show-current
git log --oneline -5
```

Also say: what you were trying to do, whether your work is committed/pushed, and whether you changed shared files. Never include `.env` contents, passwords, tokens, or API keys.

## 10. Five-minute pre-PR checklist

- [ ] I am not on `main`.
- [ ] `git status` shows only intended changes.
- [ ] I pulled/merged the latest `main` into my branch.
- [ ] The app runs and I tested the changed feature.
- [ ] No secrets, `.env`, or `node_modules` are included.
- [ ] My commit messages explain the change.
- [ ] My PR explains what changed and how to test it.
- [ ] A teammate reviewed it before it is merged.
