import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC = "isPublic";

/**
 * Opens a route to visitors who are not signed in. Every other route requires an organizer.
 * The list of public routes is pinned by a test (`auth.test.ts`), so opening one is deliberate.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
