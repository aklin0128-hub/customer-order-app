export async function withTiming<T>(
  label: string,
  fn: () => Promise<T>
): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - start);
  if (process.env.NODE_ENV !== "test") {
    console.info(`[timing] ${label}: ${ms}ms`);
  }
  return { result, ms };
}
