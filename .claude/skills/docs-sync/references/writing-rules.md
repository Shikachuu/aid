# Writing rules for docs/content

Every page under `docs/content/` follows these rules. They apply to prose, not to code blocks, identifiers, or quoted tool output.

## Voice

- Lead with what the feature does. No preamble, no "In this guide we will".
- ASCII punctuation only. No em dashes, no unicode arrows; use `-` and `->`.
- State what is stubbed or broken plainly. If a feature does not work yet, say so in a `> [!WARNING]` callout. Never describe planned behavior as current behavior.

## Words

- Plain words. Never use: additionally, crucial, delve, enduring, enhance, fostering, garner, interplay, intricate, landscape, leverage, pivotal, showcase, tapestry, testament, underscore, utilize, vibrant.
- Say "is" or "has", not "serves as", "stands as", "boasts", "features".
- No abstract metaphor nouns: substrate, wedge, vector, locus, nexus, primitive, harness, surface, bedrock, scaffolding, paradigm, north star, flywheel. Pick the concrete word.
- Cut filler and hedging. "In order to" becomes "To". Delete "it is important to note that".
- Cut adverbs or use a stronger verb. Replace "significantly faster" with the measured number.
- Pick one term per concept and repeat it. Do not cycle synonyms ("page", "document", "file" for the same thing).

## Sentences

- Active voice, name the actor. "aid copies the image next to the page", not "the image is copied".
- One idea per sentence. Whole sentences with articles and verbs.
- No "not just X, but Y". No forced groups of three. No "from X to Y" where X and Y are not on one scale.
- No -ing tails ("..., ensuring that ..."). No vague attributions ("users often find").
- Colons only before a list or an example, never as a mid-sentence connector.
- No aphorisms, rhetorical fragments, or personified code ("aid wants", "the router knows").
- No generic conclusions. End a page when the facts end.

## Formatting

- Sentence case headings.
- Bold sparingly, never on every proper noun.
- No "**Label:** restates the line" bullets. Write a sentence.
- Bullets for lists of parallel facts, tables for key/value reference, prose for explanations.
- If a sentence could appear unchanged in another project's docs, cut it. Name the mechanism, the file, the flag, or the number.
