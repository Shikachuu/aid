# Page template

Use this outline for a feature page. Drop sections that have nothing to say; do not pad.

````md
---
title: Feature name
description: One sentence on what the feature does for the reader.
sidebar:
  order: 3
---

One or two sentences: what the feature does and when it runs.

## Use it

The smallest working example: the file to write, the command to run, the output to expect.

```sh
aid build
```

## Configure it

The keys that change its behavior, with a link to the generated table in
[the configuration reference](../reference/configuration.md) instead of a copy of it.

## How it works

The mechanism, in the order aid runs it. Name the files, flags, and outputs.

## Errors

The messages the reader can hit, what causes each one, and the fix.

## Limitations

> [!WARNING]
> Not implemented yet: the part that does not work, stated plainly.
````
