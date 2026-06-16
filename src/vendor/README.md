# Self-hosted frontend dependencies

These files are vendored so the simulator can run without CDN or Google Fonts
network access after deployment.

| Package | Version | Used for | Source package |
|---|---:|---|---|
| CodeMirror | 5.65.21 | Browser editor and hint UI | `codemirror@5.65.21` |
| Material Components Web | 14.0.0 | Material button/component styles | `material-components-web@14.0.0` |
| Material Icons | 1.13.14 | Ligature icon font for `.material-icons` | `material-icons@1.13.14` |

Keep versions pinned. Do not switch back to `@latest` CDN URLs for a faculty
deployment, because that makes the delivered app depend on third-party runtime
availability and mutable upstream releases.

Each package directory keeps its upstream `LICENSE` and `package.json`.
