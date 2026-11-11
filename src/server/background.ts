// Work that must not hold up, or fail, the response it came from, such as
// sending email. Pencil runs as one long-lived Node server, so a task started
// here simply keeps running after the response is sent.

const pending = new Set<Promise<void>>();

/**
 * Starts `task` without waiting for it. A failure is logged and never reaches
 * the caller, so the request that started it succeeds either way.
 */
export function runInBackground(name: string, task: () => Promise<void>): void {
  const run = Promise.resolve()
    .then(task)
    .catch((error) => console.error(`Background task "${name}" failed:`, error))
    .finally(() => pending.delete(run));
  pending.add(run);
}

/** Resolves once every task started so far has finished. Tests use it to wait for side effects. */
export async function backgroundTasksSettled(): Promise<void> {
  while (pending.size > 0) await Promise.all(pending);
}
