interface NodeBufferInstance {
  subarray(start?: number, end?: number): Uint8Array;
  toString(encoding: string): string;
}

interface NodeBufferCtor {
  from(data: string | Uint8Array, encoding?: string): NodeBufferInstance;
}

export function getNodeBuffer(): NodeBufferCtor | undefined {
  const candidate = (globalThis as { Buffer?: NodeBufferCtor }).Buffer;
  if (!candidate || typeof candidate.from !== "function") {
    return undefined;
  }
  return candidate;
}
