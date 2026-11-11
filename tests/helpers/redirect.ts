/**
 * Runs page code that may call Next's `redirect()`, and returns where it sent
 * the visitor (path and query), or null when it let them stay.
 */
export async function redirectOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    // `redirect()` throws an error whose digest is "NEXT_REDIRECT;<type>;<url>;<status>;".
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT;")) {
      return digest.split(";")[2];
    }
    throw error;
  }
}
