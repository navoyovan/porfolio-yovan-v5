---
title: "Architecting a Modular Portfolio with Astro 5"
publishDate: 2026-10-07
description: "A quick look into decoupling monolithic page data into Content Collections and wiring bidirectional project relationships."
tags: ["Astro", "Web Architecture", "Portfolio"]
project: "mctextureghost"
---

## Overview

When building a high-density developer portfolio, a common architectural anti-pattern is hardcoding all project metadata, tech stacks, and feature descriptions directly into the homepage template. Over time, page templates balloon into thousands of lines of mixed presentation and static data.

By migrating to **Astro 5 Content Collections**, we decouple the presentation layer from the data model, achieving:
- **Type-safe data modeling:** Validated with Zod schemas at build time.
- **Relational linking:** Blog posts can directly reference project IDs via `reference('projects')`.
- **Zero runtime client overhead:** All relationship resolution occurs during static site generation (SSG).

---

## Inter-Collection Schema Architecture

Here is how the relational schema is declared in `src/content.config.ts`:

```ts
import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    category: z.string(),
    description: z.string(),
    tech: z.array(z.string()).default([]),
    href: z.string().optional(),
    github: z.string().optional(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    publishDate: z.coerce.date(),
    description: z.string(),
    tags: z.array(z.string()).default([]),
    project: reference('projects').optional(),
  }),
});

export const collections = { projects, blog };
```

---

## Performance & Build Characteristics

| Property | Monolithic Page (Before) | Content Collections (After) |
|---|---|---|
| **Data Separation** | Inline inside `.astro` template | Dedicated `src/content/projects/*.json` |
| **Schema Validation** | None (Runtime prone) | Strict compile-time Zod validation |
| **Relational Queries** | Manual array filtering | Native `getEntry(post.data.project)` |
| **Build Compatibility** | SSG (Static) | SSG (Zero Client JS) |

---

## Next Steps

With this pipeline established:
1. The **Related Project** card automatically renders above this article, pulling live metadata from `mctextureghost.json`.
2. Large technical case studies—such as the **mcTextureGhost v1.1.2 Performance Optimization**—can be dropped into `src/content/blog/` as pure markdown files without modifying layout templates.
