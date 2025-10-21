// Asta popup rendering and identifier enhancement
// This module handles converting any identifier (DOI/ArXiv/CorpusId) to S2 corpusId
// and rendering the Asta chat button popup

import React from 'react'
import { render } from 'react-dom'
import HideableTally from '../components/HideableTally'
import styles from './asta-popup.css' // Asta-specific styles (includes CSS-only arrow icons)
import { matchReferenceS2Batch, checkShowable, extractArxivId, extractCorpusId } from './s2-integration'

const ASTA_CHAT_BASE_URL = 'https://nora.allen.ai/chat?trigger=reader&trigger_context=%7B%22corpusId%22%3A%20'
const ASTA_CHAT_PARAMS = '%7D&message_id=7af3e2de-2098-4bc4-987e-fcf0985355a2&utm_source=extension&utm_medium=paper'

const buildAstaChatUrl = (corpusId) => `${ASTA_CHAT_BASE_URL}${corpusId}${ASTA_CHAT_PARAMS}`

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
 */
async function convertToCorpusId (identifier) {
  if (!identifier) return null

  // Already have corpusId
  if (identifier.toLowerCase().startsWith('corpusid:')) {
    const id = identifier.replace(/corpusid:/i, '')
    return id
  }

  // Convert DOI or ARXIV to corpusId via S2 API
  // S2 batch API accepts DOI:xxx or ARXIV:xxx format
  let prefixedId = identifier
  if (!identifier.includes(':') && identifier.startsWith('10.')) {
    // Plain DOI, add prefix
    prefixedId = `DOI:${identifier}`
  }

  try {
    const result = await matchReferenceS2Batch({
      paperIds: [prefixedId],
      fields: 'corpusId'
    })

    if (result && result[0] && result[0].corpusId) {
      return result[0].corpusId
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
            Ask Asta about this paper
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

  // Convert to corpusId
  const corpusId = await convertToCorpusId(identifier)

  if (!corpusId) {
    return
  }

  // Check if Asta can show this paper
  const result = await checkShowable(corpusId)
  if (result && result.showable === false) {
    return
  }

  // Render the popup
  renderAstaPopup(corpusId)
}
