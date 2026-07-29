import type { CollectionEntry } from "astro:content";
import { postFilter } from "./postFilter";

/**
 * Returns posts that are eligible to be shown to users, sorted by “last updated”
 * descending (uses `updatedAt` when present, otherwise `publishedAt`).
 *
 * Note: filtering respects drafts and scheduled posts via `postFilter()`.
 */
export function getSortedPosts(posts: CollectionEntry<"posts">[]) {
  return posts
    .filter(postFilter)
    .sort(
      (a, b) =>
        Math.floor(
          new Date(b.data.updatedAt ?? b.data.publishedAt).getTime() / 1000
        ) -
        Math.floor(
          new Date(a.data.updatedAt ?? a.data.publishedAt).getTime() / 1000
        )
    );
}
