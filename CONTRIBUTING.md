# Contributing to EcoMind OS

Thank you for your interest in contributing! This guide covers our team Git workflow, coding standards, and PR process.

## Quick Start

1. **Fork** the repository (if external contributor) or **clone** directly
2. **Create a feature branch** from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feat/your-feature-name
   ```
3. **Make changes** following our conventions
4. **Commit** using Conventional Commits format
5. **Push** and create a Pull Request to `develop`

## Branch Strategy (Git Flow)

```
main ──────●────────────●─────── (production releases)
           \            /
develop ────●────●──────●─────── (integration branch)
            \  / \  /
             ●     ●            (feature branches)
```

| Branch | Purpose | Protection |
|--------|---------|------------|
| `main` | Production releases | PR review + CI + linear history |
| `develop` | Daily integration | PR review + CI |
| `feature/*` | New features | None (merge to develop via PR) |
| `release/*` | Release preparation | Merge to main + develop |
| `hotfix/*` | Emergency fixes | Merge to main + develop |

### Branch Naming

- Feature: `feat/short-description` (e.g., `feat/chat-integration`)
- Fix: `fix/short-description` (e.g., `fix/login-redirect`)
- Refactor: `refactor/short-description`
- Release: `release/v1.x.x`
- Hotfix: `hotfix/v1.x.x`

## Commit Convention (Conventional Commits)

All commits MUST follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `style` | Formatting, no logic change |
| `refactor` | Code refactoring |
| `perf` | Performance improvement |
| `test` | Adding/updating tests |
| `chore` | Build/tooling changes |
| `ci` | CI/CD changes |
| `build` | Build system changes |
| `revert` | Revert previous commit |

### Examples

```
feat(chat): add real-time message streaming
fix(api): resolve 404 on /health endpoint
docs(readme): update deployment instructions
test(auth): add JWT token expiry tests
refactor(engine): simplify agent loop state machine
```

## Pull Request Process

1. **Base branch**: Always target `develop` (except release/hotfix -> `main`)
2. **Title format**: Must follow Conventional Commits (e.g., `feat: add dashboard`)
3. **Description**: Fill in the PR template completely
4. **CI must pass**: All checks green before review
5. **Review**: At least 1 approval required
6. **Squash merge**: Keep history clean

## Daily Workflow

```bash
# Morning: sync latest changes
git fetch origin
git checkout develop
git pull origin develop

# Start feature work
git checkout -b feat/my-feature develop

# During development: keep in sync
git fetch origin
git rebase origin/develop

# Ready to submit: clean up commits
git rebase -i origin/develop   # squash fixups, reword messages
git push --force-with-lease   # safe force push to YOUR branch only

# Create PR
gh pr create --base develop --title "feat: my feature" --fill
```

## Emergency Hotfix

```bash
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug main

# Fix the bug, commit, push
git push -u origin hotfix/critical-bug

# PR to main, merge, then sync back to develop
gh pr create --base main --title "fix: critical bug" --fill
# After merge:
git checkout develop
git merge main
git push origin develop
```

## Code Style

- **Python**: Follow PEP 8, use `ruff` for linting
- **TypeScript**: Follow existing patterns, strict mode preferred
- **No large files**: Git tracks text, use Git LFS for binaries > 50MB

## Questions?

Create an issue with the `question` label or reach out in team chat.
