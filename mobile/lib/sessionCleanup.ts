/** Attempt every cleanup, including when an earlier provider fails. No raw errors escape. */
export async function cleanupSession(tasks: (() => Promise<unknown>)[]): Promise<boolean> {
  const results = await Promise.allSettled(tasks.map((task) => Promise.resolve().then(task)));
  return results.every((result) => result.status === "fulfilled");
}
