# Renovate Bot — Self-Hosted Setup Guide

## Repository / folder layout

```
.                               ← A dedicated "renovate-config" repo
├── .github/
│   └── workflows/
│       └── renovate.yaml       ← GitHub Actions workflow (runs the bot)
├── renovate/
│   ├── config.js               ← Self-hosted runner config (which repos to scan)
│   ├── renovate.json5          ← Shared global Renovate preset for Helm repos
│   └── repo-template.json5     ← Minimal root config stub for each target repo
└── Chart.yaml.examples         ← Reference Chart.yaml snippets (do NOT commit as-is)
```

> **Two-repo model** — `config.js` lives in this *runner* repo. The shared
> preset also lives here in `renovate/renovate.json5`. Each target repo keeps
> only a tiny `.github/renovate.json5` or `.github/renovate.json` file that
> extends this shared preset.

---

## 1. Create the GitHub Personal Access Token (PAT)

### Required scopes

| Scope | Reason |
|---|---|
| `repo` | Read code, open PRs, post comments |
| `read:org` | Enumerate repos under the `nbmustafa` org |
| `workflow` | Allow Renovate to update `.github/workflows/` files |

### Steps

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Set *Resource owner* to `nbmustafa`.
3. Under *Repository access*, choose **Only select repositories** and tick the four target repos.
4. Grant the scopes in the table above.
5. Click **Generate token** and copy the value immediately — it is shown only once.

---

## 2. Store the PAT as a GitHub Actions secret

> GitHub Actions automatically **masks** every registered secret value in
> all log output — even if your code accidentally prints it to stdout.
> The raw token value is never visible in workflow logs, artifacts, or
> the GitHub UI after initial creation.

### In the *runner* repository (where the workflow lives)

```
Settings → Secrets and variables → Actions → New repository secret

Name:  RENOVATE_TOKEN
Value: <paste your PAT here>
```

If you host multiple runner repos inside an organisation, you can instead
store the secret at the **organisation** level and grant access to specific
repositories — avoiding duplication.

### Environment reference in the workflow

```yaml
env:
  RENOVATE_TOKEN: ${{ secrets.RENOVATE_TOKEN }}
```

`${{ secrets.RENOVATE_TOKEN }}` is resolved at runtime by the Actions runner
and injected as an environment variable. The literal string `RENOVATE_TOKEN`
is stored in `config.js` as `process.env.RENOVATE_TOKEN` — again, never
hard-coded.

---

## 3. Onboard a new Helm repository

Use these steps any time you want Renovate to manage a new Helm wrapper or
template repository.

### Step 1. Add the repository to the runner allow-list

Edit [renovate/config.js](https://github.com/nbmustafa/renobot/blob/main/renovate/config.js) and add the new repository to the
`repositories` array.

Example:

```js
repositories: [
  "nbmustafa/external-dns",
  "nbmustafa/new-service",
],
```

This tells the self-hosted Renovate runner that it is allowed to scan and
open PRs for that repository.

### Step 2. Add a Renovate stub in the target repo

Create a file named `.github/renovate.json5` in the target repository.
That file should be very small and should only extend the shared preset from
this `renobot` repository.

```json5
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["github>nbmustafa/renobot//renovate/renovate.json5"]
}
```

You can also copy the template from `renovate/repo-template.json5`.

Directory layout in the target repo:

```text
target-repo/
├── Chart.yaml
├── Chart.lock
└── .github/
    └── renovate.json5
```

### Step 3. Make sure the target repo has a valid Chart.yaml

Renovate's Helm manager reads dependency versions from `Chart.yaml`, so the
target repo must declare its upstream chart dependency there.

At minimum, make sure `Chart.yaml` contains:

1. A `dependencies[]` entry with the correct upstream chart name.
2. The correct upstream `repository` URL.
3. A `# renovate: ...` annotation immediately above the dependency entry.

Example:

```yaml
dependencies:
  # renovate: datasource=helm registryUrl=https://kubernetes-sigs.github.io/external-dns/ depName=external-dns
  - name: external-dns
    version: "1.15.1"
    repository: "https://kubernetes-sigs.github.io/external-dns/"
```

Follow [Chart.yaml.examples](https://github.com/nbmustafa/renobot/blob/main/Chart.yaml.examples) for full examples.

### Step 4. Regenerate and commit Chart.lock

Run:

```bash
helm dependency update
```

Then commit `Chart.yaml` and `Chart.lock` together in the target repository.
This gives Renovate a clean starting point and ensures lockfile updates stay
in sync with chart dependency bumps.

### Step 5. Merge the target repo config first

Open and merge the PR in the target repository that adds:

1. `.github/renovate.json5`
2. `Chart.yaml` updates
3. `Chart.lock` updates

Renovate cannot manage the repository until that repo config file exists on
the default branch.

### Step 6. Merge the runner repo change

If you changed `renovate/config.js` in `renobot` to add the repository name,
merge that PR as well.

Renovate needs both sides in place:

1. The runner must be allowed to scan the repo.
2. The target repo must extend the shared config.

### Step 7. Trigger a validation run

After both PRs are merged, run the Renovate workflow manually:

```text
GitHub → Actions → "🤖 Renovate Bot" → Run workflow
  dry_run: true
  log_level: debug
```

In the logs, confirm that Renovate:

1. Starts the new repository.
2. Detects `Chart.yaml`.
3. Extracts Helm dependencies.
4. Sees available updates or reports that everything is already current.

### Step 8. Switch to normal runs

Once the dry-run looks correct, run it again with:

```text
dry_run: false
log_level: debug
```

Or just wait for the next scheduled run every 6 hours.

### Quick checklist

Before expecting PRs, verify all of the following are true:

1. The repo is listed in `renovate/config.js`.
2. The target repo has `.github/renovate.json5` or `.github/renovate.json`.
3. The repo config extends `github>nbmustafa/renobot//renovate/renovate.json5`.
4. `Chart.yaml` has a valid Helm dependency and `# renovate:` annotation.
5. `Chart.lock` exists and matches the dependency definition.
6. Both the target repo PR and the `renobot` PR are merged.

---

## 4. Bulk-add the Renovate stub to existing target repos

```bash
for repo in fluent-bit grafana prometheus argocd; do
  gh repo clone nbmustafa/$repo /tmp/$repo
  mkdir -p /tmp/$repo/.github
  cp renovate/repo-template.json5 /tmp/$repo/.github/renovate.json5
  cd /tmp/$repo
  git checkout -b add-renovate-config
  git add .github/renovate.json5
  git commit -m "chore: add Renovate bot configuration"
  gh pr create --title "chore: add Renovate bot configuration" \
               --body  "Adds a Renovate config under .github/ that extends the shared preset from the renobot repository." \
               --base  main
  cd -
done
```

The resulting file in each target repo can stay as small as:

```json5
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["github>nbmustafa/renobot//renovate/renovate.json5"]
}
```

---

## 5. Update Chart.yaml in each target repo

Follow the annotated `Chart.yaml.examples` file. The critical parts are:

1. Add `dependencies[]` with the correct upstream `repository` URL.
2. Add the `# renovate: datasource=helm registryUrl=... depName=...` comment
   on the line **immediately above** the dependency entry.
3. Run `helm dependency update` to generate / refresh `Chart.lock`.

Commit `Chart.yaml` **and** `Chart.lock` together. Renovate will update both
files in its PRs.

---

## 6. Trigger a manual dry-run to validate

```
GitHub → Actions → 🤖 Renovate Bot → Run workflow
  dry_run:   true
  log_level: debug
```

Check the workflow logs. You should see Renovate discover the Chart.yaml
dependencies and report which PRs *would* be opened without actually opening
them.

---

## 7. Schedule

The workflow runs on `cron: "0 */6 * * *"` — 00:00, 06:00, 12:00, 18:00 UTC.
Change the cron expression in `.github/workflows/renovate.yaml` to suit your
team's cadence.

---

## Chart.yaml ↔ values.yaml synchronisation

| File | Field | Updated by |
|---|---|---|
| `Chart.yaml` | `dependencies[].version` | Renovate helmv3 manager ✅ (automatic) |
| `Chart.yaml` | `appVersion` | Renovate regexManager ✅ (if configured) or manual |
| `values.yaml` | `image.tag` | Renovate regexManager ✅ (if configured) or manual |
| `Chart.lock` | `dependencies[].version` / `digest` | Renovate post-upgrade task ✅ (automatic) |

See the `regexManagers` comment block in the shared `renovate.json5` to enable full
automatic synchronisation of `appVersion` and `image.tag` in the same PR.

---

## Upgrading the pinned Renovate version

The workflow pins `renovate-version: "37.440.0"`. To bump it:

1. Check the [Renovate releases page](https://github.com/renovatebot/renovate/releases).
2. Update the version string in `renovate.yaml`.
3. Open a PR, let CI pass, then merge.

You can also let Renovate manage its own version by adding this to the shared `renovate.json5`:

```json
"extends": ["helpers:pinGitHubActionDigests"]
```
