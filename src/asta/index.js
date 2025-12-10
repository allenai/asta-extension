// Asta extension monkeypatch - single entry point for all Asta-specific code
//
// This module consolidates all Asta and S2 integration code in one place,
// making it clear what code we maintain vs what comes from upstream.
//
// Monkeypatch surface:
// - src/index.js: imports from './asta' instead of defining S2 code inline
// - src/badges.js: imports insertAstaBadges from './asta'

// S2 API integration and identifier handling
export {
  s2IdPrefixes,
  hasS2Prefix,
  extractArxivId,
  extractCorpusId,
  matchReferenceS2,
  matchReferenceS2Batch
} from './s2-integration'

// Asta badge creation and insertion
export {
  createAstaBadge,
  insertAstaBadges
} from './asta-badges'

// Asta popup rendering
export {
  insertAstaPopup
} from './asta-popup'

// S2-based reference matching (replaces scite API)
export {
  matchReference
} from './reference-matching-s2'
