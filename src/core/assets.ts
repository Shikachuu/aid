type WriteData = string | Blob

/**
 * Collects every file a build writes into `outputDir` and holds the bytes until
 * {@link AssetRegistry.flush}. Two sources that target one path throw at
 * registration, and a build that fails before the flush leaves `outputDir`
 * untouched instead of half-written.
 */
export class AssetRegistry {
  private sources = new Map<string, string>()
  private pending = new Map<string, WriteData>()

  register(outputPath: string, sourceLabel: string): void {
    const existing = this.sources.get(outputPath)
    if (existing && existing !== sourceLabel) {
      throw new Error(
        `aid: asset collision: both "${existing}" and "${sourceLabel}" target ${outputPath}. Rename one of the sources.`,
      )
    }
    this.sources.set(outputPath, sourceLabel)
  }

  write(outputPath: string, sourceLabel: string, data: WriteData): void {
    this.register(outputPath, sourceLabel)
    this.pending.set(outputPath, data)
  }

  async flush(): Promise<void> {
    const pending = [...this.pending]
    this.pending.clear()
    await Promise.all(pending.map(([outputPath, data]) => Bun.write(outputPath, data)))
  }
}
