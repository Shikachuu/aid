import { attachMermaid } from "./mermaid"

/**
 * Dedicated entry for the mermaid runtime. Pages that don't contain a
 * `<pre class="mermaid">` block never load this bundle, keeping the prose
 * critical path under a kilobyte.
 */
void attachMermaid()
