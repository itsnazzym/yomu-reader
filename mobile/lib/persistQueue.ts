export type PersistTask = () => Promise<void>;

export function createWriteQueue() {
  let chain: Promise<void> = Promise.resolve();

  function enqueue(task: PersistTask): Promise<void> {
    chain = chain.catch(() => undefined).then(task);
    return chain;
  }

  function flush(): Promise<void> {
    return chain.catch(() => undefined);
  }

  return { enqueue, flush };
}

export function createInitOnce(loader: () => Promise<void>) {
  let promise: Promise<void> | null = null;

  return function init(forceReload = false): Promise<void> {
    if (forceReload || !promise) {
      // A transient storage failure must not poison the module for the rest of
      // the process. Keep sharing a successful/in-flight initialization, but
      // clear a rejected one so the next foreground action can retry it.
      promise = loader().catch((error) => {
        promise = null;
        throw error;
      });
    }
    return promise;
  };
}
