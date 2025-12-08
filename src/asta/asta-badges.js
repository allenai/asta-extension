// Asta "Ask about this paper" badge integration
import { matchReferenceS2, matchReferenceS2Batch } from './s2-integration'
import { sliceIntoChunks } from '../util'

// Base URL injected at build time based on TARGET environment variable
const ASTA_UI_URL = process.env.ASTA_UI_URL

const buildAstaChatUrl = (corpusId) => `${ASTA_UI_URL}/?corpus_id=${corpusId}&utm_source=extension&utm_medium=badge`

export function createAstaBadge (corpusId) {
  return `
    <div class="asta-extension-badge">
      <a href="${buildAstaChatUrl(corpusId)}" target="_blank" style="text-decoration: none; display:block; padding-top:8px;">
        <button style="padding: 4px 8px; color: #3ABA87; border: 1px solid #3ABA87; background-color: #ffffff; border-radius: 4px; cursor: pointer; font-family:manrope, arial, sans-serif;">
          Ask AI about this paper
        </button>
      </a>
    </div>
  `
}

function removeElementsByQuery (query, parentEl = document) {
  const elements = parentEl.querySelectorAll(query)
  for (const element of elements) {
    element.parentNode?.removeChild(element)
  }
}

// Helper to add delay between batches to avoid rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Guard to prevent concurrent executions
let isRunning = false

// This function will be called by the main extension to insert Asta badges
// It reuses the same BADGE_SITES structure from badges.js
export async function insertAstaBadges (badgeSite, findDoiEls) {
  if (!badgeSite) {
    return
  }

  // Prevent concurrent executions
  if (isRunning) {
    return
  }

  isRunning = true

  // Remove old Asta badges
  removeElementsByQuery('.asta-extension-badge')

  const els = findDoiEls()
  if (!els || els.length <= 0) {
    isRunning = false
    return
  }

  // Deduplicate by reference title or DOI to avoid processing same paper twice
  const seen = new Set()
  const refsToResolve = []
  const badgesWithDOIs = []
  for (const el of els) {
    const key = el.doi || el.reference?.title || ''

    if (key && seen.has(key)) {
      continue
    }
    if (key) seen.add(key)

    if (el.doi) {
      badgesWithDOIs.push(el)
    } else {
      refsToResolve.push(el)
    }
  }

  const badges = []
  const stats = {
    refsNoCorpusId: 0,
    refsNoFulltext: 0,
    doisNoCorpusId: 0,
    doisNoFulltext: 0
  }

  // Process references and DOIs in parallel (independent operations)
  // Only add badges for papers with full text available (textAvailability === 'fulltext')
  await Promise.all([
    // Process papers without DOIs via /search/match
    (async () => {
      const jobs = sliceIntoChunks(refsToResolve, 10)
      for (let i = 0; i < jobs.length; i++) {
        const batch = jobs[i]
        await Promise.all(batch.map(async el => {
          const result = await matchReferenceS2(el.reference)
          if (!result?.corpusId) {
            stats.refsNoCorpusId++
          } else if (result.textAvailability !== 'fulltext') {
            stats.refsNoFulltext++
          } else {
            badges.push({ ...el, corpusId: result.corpusId })
          }
        }))
        // Small delay to prevent rate limiting
        if (i < jobs.length - 1) {
          await delay(200)
        }
      }
    })(),

    // Process papers with DOIs via /paper/batch
    (async () => {
      const jobs2 = sliceIntoChunks(badgesWithDOIs, 20)
      for (let i = 0; i < jobs2.length; i++) {
        const batch = jobs2[i]
        const result = await matchReferenceS2Batch({
          paperIds: batch.map(badge => `DOI:${badge.doi}`)
        })
        if (Array.isArray(result) && result.length === batch.length) {
          batch.forEach((badge, j) => {
            if (!result[j]?.corpusId) {
              stats.doisNoCorpusId++
            } else if (result[j].textAvailability !== 'fulltext') {
              stats.doisNoFulltext++
            } else {
              badges.push({ ...badge, corpusId: result[j].corpusId })
            }
          })
        }
      }
    })()
  ])

  // Log stats for debugging
  if (stats.refsNoCorpusId || stats.refsNoFulltext || stats.doisNoCorpusId || stats.doisNoFulltext) {
    console.debug('[Asta] Badge stats:', stats)
  }

  removeElementsByQuery('.asta-extension-badge')
  for (const badge of badges) {
    badge.citeEl.insertAdjacentHTML(badgeSite.position, createAstaBadge(badge.corpusId))

    // Google Scholar author pages intercept clicks on citation elements
    // Add click handler to prevent propagation (only on author pages)
    if (badgeSite.name === 'scholar.google' && window.location.pathname.includes('/citations')) {
      const badgeLink = badge.citeEl.querySelector('.asta-extension-badge a')
      if (badgeLink) {
        badgeLink.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          event.stopImmediatePropagation()
          window.open(badgeLink.href, '_blank')
        })
      }
    }
  }

  // Release the lock
  isRunning = false
}
