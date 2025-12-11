// Asta popup rendering and identifier enhancement
// This module handles converting any identifier (DOI/ArXiv/CorpusId) to S2 corpusId
// and rendering the Asta chat button popup

import React from 'react'
import { render } from 'react-dom'
import HideableTally from '../components/HideableTally'
import styles from './asta-popup.css' // Asta-specific styles (includes CSS-only arrow icons)
import { matchReferenceS2Batch, extractArxivId, extractCorpusId } from './s2-integration'

// Base URL injected at build time based on TARGET environment variable
const ASTA_UI_URL = process.env.ASTA_UI_URL

const buildAstaChatUrl = (corpusId) => `${ASTA_UI_URL}/?corpus_id=${corpusId}&utm_source=extension&utm_medium=paper`

let poppedUp = false

/**
 * Enhance the identifier found by upstream
 *
 * Strategy: Let upstream's findDoi() run first, then check if we can
 * find a better identifier on the current page:
 * - ArXiv papers: prefer ARXIV:xxx over DOI (faster S2 lookup)
 * - Semantic Scholar: prefer CorpusId:xxx (already have it, no API call)
 * - Other papers: use DOI from upstream
 *
 * This pattern lets us benefit from upstream's identifier strategies
 * without modifying them.
 *
 * @param {string|null} doi - DOI found by upstream's findDoi(), or null
 * @returns {Promise<string|null>} Enhanced identifier (DOI, ARXIV:xxx, or CorpusId:xxx)
 */
async function enhanceIdentifier (doi) {
  // Always prefer native IDs over DOI (faster lookups, no API call needed)
  const arxivId = extractArxivId()
  if (arxivId) return arxivId

  const corpusId = extractCorpusId()
  if (corpusId) return corpusId

  // Fall back to DOI from upstream (or null)
  return doi
}

/**
 * Convert any identifier (DOI, ARXIV:, CorpusId:) to S2 corpusId
 * Returns { corpusId, textAvailability } or null
 */
async function convertToCorpusId (identifier) {
  if (!identifier) return null

  // Already have corpusId - still need to fetch textAvailability from API
  let prefixedId = identifier
  if (identifier.toLowerCase().startsWith('corpusid:')) {
    prefixedId = identifier // Already in correct format
  } else if (!identifier.includes(':') && identifier.startsWith('10.')) {
    // Plain DOI, add prefix
    prefixedId = `DOI:${identifier}`
  }

  // Fetch paper data including textAvailability
  try {
    const result = await matchReferenceS2Batch({
      paperIds: [prefixedId]
      // Default fields now include textAvailability
    })

    if (result && result[0] && result[0].corpusId) {
      return {
        corpusId: result[0].corpusId,
        textAvailability: result[0].textAvailability
      }
    }
  } catch (e) {
    console.error('Failed to convert identifier to corpusId:', e)
  }

  return null
}

/**
 * Render the Asta popup button
 */
function renderAstaPopup (corpusId) {
  if (poppedUp) {
    return
  }

  const popup = document.createElement('div')
  popup.id = 'scite-popup'
  popup.scrolling = 'no'
  popup.className = styles.astaPopup

  document.documentElement.appendChild(popup)
  render(
    <HideableTally>
      <div style={{ maxWidth: '200px', padding: '8px' }}>
        <a
          href={buildAstaChatUrl(corpusId)}
          target='_blank'
          rel='noopener noreferrer'
          style={{ textDecoration: 'none' }}
        >
          <button style={{
            padding: '4px 8px',
            color: '#f0529c',
            border: '1px solid #f0529c',
            backgroundColor: '#ffffff',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: 'manrope, arial, sans-serif',
            fontSize: '14px'
          }}
          >
            Ask AI about this paper
          </button>
        </a>
      </div>
    </HideableTally>,
    popup
  )
  poppedUp = true
}

/**
 * Main entry point: insert Asta popup for a given identifier
 * Called from index.js main() instead of popupDoi()
 */
export async function insertAstaPopup (doi) {
  // Enhance the identifier (check for ArXiv/CorpusId on current page)
  const identifier = await enhanceIdentifier(doi)

  if (!identifier) {
    return
  }

  // Convert to corpusId and get textAvailability in one API call
  const result = await convertToCorpusId(identifier)

  if (!result) {
    return
  }

  // Only show popup for papers with full text available
  if (result.textAvailability !== 'fulltext') {
    return
  }

  // Render the popup
  renderAstaPopup(result.corpusId)
}
