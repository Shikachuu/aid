---
title: GitHub Pages
description: How this site deploys to GitHub Pages, and a workflow that deploys an aid site from your own repository.
sidebar:
  order: 1
---

GitHub Pages hosts the static output of `aid build`. A GitHub Actions workflow builds the site, uploads the output folder as a Pages artifact, and deploys it.

## Turn on Pages

In the repository, open Settings, then Pages, and set Source under "Build and deployment" to "GitHub Actions". Without this setting the workflow cannot deploy.

## How this site deploys

`.github/workflows/docs.yml` in the aid repository builds and deploys this site. It runs on every push to `main` and on a manual run from the Actions tab.

The `build` job:

1. checks out the repository;
2. runs `jdx/mise-action`, which installs Bun 1.3.13 from `mise.toml` and runs `mise install` with its `postinstall` hook (see [installation](../getting-started/installation.md));
3. runs `actions/configure-pages`;
4. runs `bun run docs:build`, which is `bun src/cli/index.ts build site --clean`;
5. uploads `site/dist` with `actions/upload-pages-artifact`.

The `deploy` job waits for `build`, then publishes the artifact with `actions/deploy-pages` to the `github-pages` environment. Only this job gets the `pages: write` and `id-token: write` permissions. The workflow-level permission is `contents: read`.

The workflow uses the concurrency group `pages` with `cancel-in-progress: false`, so a new push queues behind a running deploy instead of cancelling it.

`site/aid.yaml` sets the URLs for the Pages address `https://shikachuu.github.io/aid/`:

```yaml
base_url: https://shikachuu.github.io
base_path: /aid
```

## Deploy your own site

A project Pages site lives at `https://<owner>.github.io/<repo>/`. Set `base_path` to the repository name and `base_url` to the owner's Pages origin:

```yaml
name: My Docs
base_url: https://<owner>.github.io
base_path: /<repo>
```

For a repository named `<owner>.github.io`, or a site on a custom domain, the site sits at the domain root: keep the default `base_path: /`.

aid has no published release, so the workflow below checks out the aid source next to your project and runs it with Bun. It assumes `aid.yaml` sits at the repository root and keeps the default `dir.output: dist`.

```yaml
name: Docs

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Check out the site
        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
        with:
          persist-credentials: false

      - name: Check out aid
        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
        with:
          repository: Shikachuu/aid
          ref: main
          path: .aid-src
          persist-credentials: false

      - name: Set up mise
        uses: jdx/mise-action@1648a7812b9aeae629881980618f079932869151 # v4.0.1

      - name: Install aid
        working-directory: .aid-src
        run: |
          mise trust
          mise install

      - name: Build the site
        working-directory: .aid-src
        run: mise exec -- bun src/cli/index.ts build "$GITHUB_WORKSPACE" --clean

      - name: Configure Pages
        uses: actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d # v6.0.0

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346 # v5.0.1
```

The aid steps run inside `.aid-src`, where `mise.toml` selects Bun 1.3.13. The build command takes your repository root, `$GITHUB_WORKSPACE`, as the project folder. Replace `ref: main` with a commit SHA to pin the aid version.

> [!NOTE]
> This workflow uses the same actions and build steps as this site's workflow. It has not been run from a separate repository.

The workflow does not use a compiled aid binary, because the binaries do not run outside the aid repository yet. The [status page](../status.html) tracks the problem.
