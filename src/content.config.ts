import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    brand: z.string().optional(),
    category: z.string(),
    categoryId: z.string().optional(),
    description: z.string(),
    descriptionId: z.string().optional(),
    tech: z.array(z.string()).default([]),
    imageSrc: z.string().optional(),
    videoSrc: z.string().optional(),
    href: z.string().optional(),
    github: z.string().optional(),
    year: z.string().optional(),
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
    image: z.string().optional(),
  }),
});

export const collections = { projects, blog };
