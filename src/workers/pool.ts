/**
 * Tiny Web-Workers pool used by `aid build` for parallel page rendering.
 * Sized to navigator.hardwareConcurrency (clamped). Each worker imports
 * render-worker.ts and processes one route at a time.
 *
 * Stub.
 */
export type WorkerPool<TIn, TOut> = {
  dispatch(input: TIn): Promise<TOut>
  close(): Promise<void>
}

export function createWorkerPool<TIn, TOut>(
  _scriptUrl: string,
  _size?: number,
): WorkerPool<TIn, TOut> {
  return {
    async dispatch(_input: TIn): Promise<TOut> {
      throw new Error("WorkerPool.dispatch(): not implemented")
    },
    async close(): Promise<void> {},
  }
}
