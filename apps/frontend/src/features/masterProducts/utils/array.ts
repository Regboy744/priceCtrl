/**
 * Split array into chunks of specified size
 * Useful for batch processing large datasets
 *
 * @param array - The array to chunk
 * @param size - The size of each chunk
 * @returns Array of chunks
 *
 * @example
 * chunk([1, 2, 3, 4, 5], 2) // [[1, 2], [3, 4], [5]]
 */
export function chunk<T>(array: T[], size: number): T[][] {
 const chunks: T[][] = []
 for (let i = 0; i < array.length; i += size) {
  chunks.push(array.slice(i, i + size))
 }
 return chunks
}

/**
 * Process items in parallel batches with concurrency limit
 *
 * @param items - Items to process
 * @param concurrency - Max number of parallel operations
 * @param processor - Async function to process each item
 * @returns Promise that resolves when all items are processed
 */
export async function processBatches<T>(
 items: T[],
 concurrency: number,
 processor: (item: T, index: number) => Promise<void>,
): Promise<void> {
 const executing: Promise<void>[] = []

 for (let i = 0; i < items.length; i++) {
  const item = items[i]!
  const promise = processor(item, i).then(() => {
   executing.splice(executing.indexOf(promise), 1)
  })

  executing.push(promise)

  if (executing.length >= concurrency) {
   await Promise.race(executing)
  }
 }

 await Promise.all(executing)
}
