import { postInputs } from "@/contracts/posts";
import { storageImageRules } from "@/server/uploads/service";

let cached: ReturnType<typeof postInputs> | undefined;

/**
 * The post input schemas with the server's image rule: inline images and
 * covers must sit in Pencil's own storage, so no post can load a tracking
 * pixel from another site. Built once, on first use, from the environment.
 */
export function serverPostInputs(): ReturnType<typeof postInputs> {
  cached ??= postInputs(storageImageRules());
  return cached;
}
