// Work that must not hold up, or fail, the response it came from, such as
// sending email or embedding a post. Pencil runs as one long-lived Node
// server, so a task started here simply keeps running after the response is
// sent.
import { after } from "next/server";

const pending = new Set<Promise<void>>();

/** Runs `task`, logging a failure instead of letting it reach anyone. Tracked until it settles. */
function guarded(name: string, task: () => Promise<void>): Promise<void> {
  const run = Promise.resolve()
    .then(task)
    .catch((error) => console.error(`Background task "${name}" failed:`, error))
    .finally(() => pending.delete(run));
  pending.add(run);
  return run;
}

/**
 * Starts `task` without waiting for it. A failure is logged and never reaches
 * the caller, so the request that started it succeeds either way.
 */
export function runInBackground(name: string, task: () => Promise<void>): void {
  void guarded(name, task);
}

/**
 * Runs `task` once the current response has been sent (Next's `after()`), so
 * it never slows the request down. Failures are logged, as in
 * `runInBackground`. Outside a request, where `after()` throws because there
 * is no response to wait for (feature tests calling route handlers, scripts),
 * the task starts in the background straight away instead.
 */
export function runAfterResponse(name: string, task: () => Promise<void>): void {
  try {
    after(() => guarded(name, task));
  } catch {
    runInBackground(name, task);
  }
}

/** Resolves once every task started so far has finished. Tests use it to wait for side effects. */
export async function backgroundTasksSettled(): Promise<void> {
  while (pending.size > 0) await Promise.all(pending);
}
