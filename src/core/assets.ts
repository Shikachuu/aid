/**
 * Tracks every file written into `outputDir` during a build. Two writers (a
 * static-asset copy and a colocated-image copy, for instance) that target the
 * same destination would silently clobber each other, so the registry throws
 * with both source labels the moment a collision is registered.
 */
export class AssetRegistry {
  private writes = new Map<string, string>()

  /**
   * Register a write at `outputPath` sourced from `sourceLabel`. Re-registering
   * the *same* (path, source) pair is a no-op (idempotent within one builder),
   * but a *different* source landing on the same outputPath throws.
   */
  register(outputPath: string, sourceLabel: string): void {
    const existing = this.writes.get(outputPath)
    if (existing && existing !== sourceLabel) {
      throw new Error(
        `aid: asset collision — both "${existing}" and "${sourceLabel}" target ${outputPath}. Rename one of the sources.`,
      )
    }
    this.writes.set(outputPath, sourceLabel)
  }
}
