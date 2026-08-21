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
      promise = loader();
    }
    return promise;
  };
}
