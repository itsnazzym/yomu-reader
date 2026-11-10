export async function withSourceDeadline<T>(request: Promise<T>, ms = 20_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([request, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("La source ne répond pas. Réessayez ou changez de source.")), ms);
    })]);
  } finally { clearTimeout(timer!); }
}

export function linkSourceSignal(signal: AbortSignal | null | undefined, controller: AbortController): () => void {
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  return () => signal?.removeEventListener("abort", abort);
}
