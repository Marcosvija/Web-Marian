import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const useTestFixtures = process.env.WEB_MARIAN_CONTENT_FIXTURES === '1';
const categoriesBase = useTestFixtures
  ? './tests/fixtures/categories'
  : './src/content/categories';

const categories = defineCollection({
  loader: glob({
    base: categoriesBase,
    pattern: '**/*.{json,yaml,yml}',
  }),
  schema: ({ image }) =>
    z.object({
      slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      title: z.string().trim().min(1),
      description: z.string().trim().min(1).max(240).optional(),
      order: z.number().int().nonnegative(),
      photos: z
        .array(
          z.discriminatedUnion('decorative', [
            z.object({
              id: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
              image: image(),
              decorative: z.literal(false),
              alt: z.string().trim().min(1),
            }),
            z.object({
              id: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
              image: image(),
              decorative: z.literal(true),
              alt: z.literal(''),
            }),
          ]),
        )
        .default([]),
    }),
});

export const collections = { categories };
