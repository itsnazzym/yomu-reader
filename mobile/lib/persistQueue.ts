export type PersistTask = () => Promise<void>;
const queues = new Set<() => Promise<void>>();
let libraryOperations: Promise<unknown> = Promise.resolve();

/** Serialize user mutations with backup capture/restore, including in-memory state. */
export function withLibraryMutation<T>(operation: () => Promise<T>): Promise<T> {
  const next = libraryOperations.catch(() => undefined).then(operation);
  libraryOperations = next;
  return next;
}

export async function flushPersistQueues(): Promise<void> {
  await Promise.all([...queues].map(flush => flush()));
}

type BackupFiles = {
  writeAsStringAsync(path: string, value: string): Promise<void>;
  moveAsync(paths: { from: string; to: string }): Promise<void>;
  deleteAsync(path: string, options?: { idempotent: boolean }): Promise<void>;
  readDirectoryAsync(path: string): Promise<string[]>;
};
let backupSequence = 0;
export async function writeRotatingBackup(files: BackupFiles, directory: string, json: string, now = Date.now()): Promise<void> {
  const name = `nhentai_autobackup_${String(now).padStart(13, "0")}_${backupSequence++}.json`;
  const temporary = `${directory}${name}.tmp`;
  try {
    await files.writeAsStringAsync(temporary, json);
    await files.moveAsync({ from: temporary, to: `${directory}${name}` });
  } catch (error) {
    await files.deleteAsync(temporary, { idempotent: true }).catch(() => {});
    throw error;
  }
  const backups = (await files.readDirectoryAsync(directory)).filter(name => /^nhentai_autobackup_\d+_\d+\.json$/.test(name)).sort().reverse();
  for (const old of backups.slice(3)) await files.deleteAsync(`${directory}${old}`, { idempotent: true });
}

export function createWriteQueue() {
  let chain: Promise<void> = Promise.resolve();

  function enqueue(task: PersistTask): Promise<void> {
    chain = chain.catch(() => undefined).then(task);
    return chain;
  }

  function flush(): Promise<void> {
    return chain;
  }

  queues.add(flush);

  return { enqueue, flush };
}

type StringStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/** Undo journal: readers are serialized; an interrupted replacement rolls back before use. */
export function createRecoverableStorage(raw: StringStorage) {
  const journalKey = "@yomu_restore_journal_v1";
  let chain: Promise<unknown> = Promise.resolve();
  let recovered = false;
  async function recover() {
    if (recovered) return;
    const journal = await raw.getItem(journalKey);
    if (journal) {
      const entries: unknown = JSON.parse(journal);
      if (!Array.isArray(entries) || entries.some(e => !Array.isArray(e) || e.length !== 2 || typeof e[0] !== "string" || e[0] === journalKey || (e[1] !== null && typeof e[1] !== "string"))) {
        throw new Error("Journal de restauration invalide. Les données restent protégées.");
      }
      for (const [key, value] of entries as [string, string | null][]) {
        if (value === null) await raw.removeItem(key);
        else await raw.setItem(key, value);
      }
      await raw.removeItem(journalKey);
    }
    recovered = true;
  }
  function run<T>(operation: () => Promise<T>): Promise<T> {
    const next = chain.catch(() => undefined).then(async () => { await recover(); return operation(); });
    chain = next;
    return next;
  }
  return {
    getItem: (key: string) => run(() => raw.getItem(key)),
    setItem: (key: string, value: string) => run(() => raw.setItem(key, value)),
    removeItem: (key: string) => run(() => raw.removeItem(key)),
    snapshot: (keys: string[]) => run(() => Promise.all(keys.map(key => raw.getItem(key)))),
    replace: (entries: [string, string][]) => run(async () => {
      if (entries.some(([key]) => key === journalKey)) throw new Error("Clé réservée.");
      const before = await Promise.all(entries.map(async ([key]) => [key, await raw.getItem(key)]));
      await raw.setItem(journalKey, JSON.stringify(before));
      recovered = false;
      try {
        for (const [key, value] of entries) await raw.setItem(key, value);
        await raw.removeItem(journalKey);
        recovered = true;
      } catch (error) {
        await recover();
        throw error;
      }
    }),
  };
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
