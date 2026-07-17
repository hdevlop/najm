# Main Branch Protection

Configure `main` in GitHub repository settings with:

- require a pull request before merging
- require approvals before merging
- require status checks to pass before merging
- require branches to be up to date before merging
- require the `CI` workflow jobs from `.github/workflows/ci.yml`
- restrict force pushes and deletions

Branch protection is repository settings state, not a versioned file, so this
document is the checklist for maintainers applying the L1 release gate.
