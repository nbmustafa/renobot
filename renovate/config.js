/**
 * Renovate Self-Hosted Runner Configuration
 * -----------------------------------------
 * This file is loaded by the Renovate CLI at startup.
 * It controls WHICH repositories are managed and global runner behaviour.
 *
 * Docs: https://docs.renovatebot.com/self-hosted-configuration/
 */

module.exports = {
  // ── Platform ───────────────────────────────────────────────────────────────
  platform: "github",

  /**
   * GitHub endpoint – change only if you run GitHub Enterprise Server.
   * For github.com this is always the default and can be omitted, but
   * being explicit makes intent clear and eases future migrations.
   */
  endpoint: "https://api.github.com/",

  
  /**
   * Used by Renovate to author commits and PRs.
   * Must match the identity of the PAT owner, or a dedicated bot account.
   */
  gitAuthor: "Renovate Bot <renovate-bot@users.noreply.github.com>",

  // ── Target repositories ────────────────────────────────────────────────────
  /**
   * Explicit allow-list: only these four repos will ever be touched.
   * Format: "<org-or-user>/<repo>"
   */
  repositories: [
    "nbmustafa/external-dns",
    // "nbmustafa/fluent-bit",
    // "nbmustafa/grafana",
    // "nbmustafa/prometheus",
    // "nbmustafa/argocd",
  ],

  // ── Onboarding ─────────────────────────────────────────────────────────────
  /**
   * Each repo already carries a renovate.json (provided separately).
   * Disable the first-run onboarding PR so Renovate starts working
   * immediately without waiting for a merge.
   */
  onboarding: false,

  /**
   * Still require a renovate.json to be present in the repo root.
   * This acts as a safety gate: Renovate will not touch a repo unless
   * an explicit config exists, preventing accidental changes.
   */
  requireConfig: "required",

    /**
   * Seed the onboarding PR with our production helmv3 config instead of
   * Renovate's generic boilerplate.
   *
   * "github>nbmustafa/renobot//renovate/renovate.json" is a
   * Renovate config-preset URL pointing at renovate.json in THIS runner repo.
   * When Renovate opens the onboarding PR in e.g. nbmustafa/grafana, it
   * pre-populates the new renovate.json with a single "extends" line that
   * pulls the full helmv3 ruleset from the central config.
   *
   * This means all five target repos share a single source of truth.
   * To update rules for every repo at once, edit renovate/renovate.json
   * in this runner repo only — no need to open PRs in each target repo.
   *
   * Replace "renovate-config" below with whatever you name THIS repository.
   */
  onboardingConfig: {
    "$schema": "https://docs.renovatebot.com/renovate-schema.json",
    "extends": ["github>nbmustafa/renobot//renovate/renovate.json5"],
  },
 
  /** Human-readable PR metadata shown on the onboarding PR. */
  onboardingPrTitle: "chore: configure Renovate Bot for Helm chart tracking",
  onboardingCommitMessage: "chore: add Renovate config for Helm chart auto-updates",

  /**
   * Never create more than 10 open PRs per repository at one time.
   * Keeps the PR queue manageable and avoids GitHub rate-limit spikes.
   */
  prConcurrentLimit: 10,

  /**
   * Wait 3 days before raising a PR for a brand-new release.
   * Filters out yanked / immediately-patched releases.
   */
  minimumReleaseAge: "3 days",


  // ── Dry-run override ───────────────────────────────────────────────────────
  /**
   * Set RENOVATE_DRY_RUN=true in the workflow environment to validate
   * config changes without actually opening PRs.
   */
  ...(process.env.RENOVATE_DRY_RUN === "true" ? { dryRun: "full" } : {}),
};
