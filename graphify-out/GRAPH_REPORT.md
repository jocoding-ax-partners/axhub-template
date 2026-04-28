# Graph Report - examples  (2026-04-28)

## Corpus Check
- 27 files · ~12,022 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 42 nodes · 40 edges · 2 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]

## God Nodes (most connected - your core abstractions)
1. `buildUrl()` - 7 edges
2. `axhubFetch()` - 7 edges
3. `axhubData()` - 7 edges
4. `request()` - 6 edges
5. `buildUrl()` - 3 edges
6. `request()` - 3 edges
7. `axhubFetch()` - 3 edges
8. `axhubData()` - 3 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"
Cohesion: 0.53
Nodes (4): axhubData(), axhubFetch(), buildUrl(), request()

### Community 1 - "Community 1"
Cohesion: 0.8
Nodes (4): axhubData(), axhubFetch(), buildUrl(), request()

## Suggested Questions
_Not enough signal to generate questions. This usually means the corpus has no AMBIGUOUS edges, no bridge nodes, no INFERRED relationships, and all communities are tightly cohesive. Add more files or run with --mode deep to extract richer edges._