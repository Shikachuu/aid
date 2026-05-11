---
title: Sample Site
description: Fixture for aid's integration tests.
---

# Sample Site

![Sample hero](./hero.svg)

This is a small fixture exercising every page kind aid supports in v0.1:

- This page (markdown).
- [`api`](./api) — an OpenAPI spec rendered with the embedded reference UI.
- [`events`](./events) — a `.proto` file rendered with aid's native proto UI.

```ts
const greet = (name: string): string => `hello, ${name}`
```

```mermaid
graph LR
  A[Source files] --> B[aid build]
  B --> C[Static site]
```
