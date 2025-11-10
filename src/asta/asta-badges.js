// Asta "Ask about this paper" badge integration
import { matchReferenceS2, matchReferenceS2Batch, checkShowable } from './s2-integration'
import { sliceIntoChunks } from '../util'

// Base URL injected at build time based on TARGET environment variable
const ASTA_UI_URL = process.env.ASTA_UI_URL

const buildAstaChatUrl = (corpusId) => `${ASTA_UI_URL}/?corpus_id=${corpusId}&utm_source=extension&utm_medium=badge`

export function createAstaBadge (corpusId) {
  return `
    <div class="asta-extension-badge">
      <a href="${buildAstaChatUrl(corpusId)}" target="_blank" style="text-decoration: none; display:block; padding-top:8px;">
        <button style="padding: 4px 8px; color: #f0529c; border: 1px solid #f0529c; background-color: #ffffff; border-radius: 4px; cursor: pointer; font-family:manrope, arial, sans-serif;">
          Ask Asta about this paper
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
  const errors = {
    refMatchFailed: 0,
    refShowableFailed: 0,
    doiShowableFailed: 0,
    refNoCorpusId: 0
  }

  // Process references and DOIs in parallel (independent operations)
  // Each checks showable inline to avoid blocking on corpusId collection
  //
  // Concurrency set to 10 for fast performance
  await Promise.all([
    // Process papers without DOIs via /search/match
    (async () => {
      const jobs = sliceIntoChunks(refsToResolve, 10)
      for (let i = 0; i < jobs.length; i++) {
        const batch = jobs[i]
        await Promise.all(batch.map(async el => {
          const result = await matchReferenceS2(el.reference)

          if (result?.corpusId) {
            try {
              const showable = await checkShowable(result.corpusId)
              badges.push({
                ...el,
                corpusId: result.corpusId,
                showable: showable?.showable
              })
            } catch (e) {
              errors.refShowableFailed++
              console.error(`[Asta] Showable check failed for ref ${result.corpusId}: ${e.message}`)
            }
          } else {
            errors.refNoCorpusId++
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
          paperIds: batch.map(badge => `DOI:${badge.doi}`),
          fields: 'corpusId'
        })
        // check that result is an array and it is the same length as batch
        if (Array.isArray(result) && result.length === batch.length) {
          // Create temp array with corpusIds
          const tempBatch = batch.map((badge, j) => ({
            ...badge,
            corpusId: result[j]?.corpusId
          })).filter(b => b.corpusId)

          // Check showable in controlled batches of 10 to avoid overwhelming MAGE
          const showableJobs = sliceIntoChunks(tempBatch, 10)
          for (let k = 0; k < showableJobs.length; k++) {
            const showableBatch = showableJobs[k]
            await Promise.all(showableBatch.map(async (badge) => {
              try {
                const showable = await checkShowable(badge.corpusId)
                badges.push({
                  ...badge,
                  showable: showable?.showable
                })
              } catch (e) {
                errors.doiShowableFailed++
                console.error(`[Asta] Showable check failed for DOI ${badge.corpusId}: ${e.message}`)
              }
            }))
            if (k < showableJobs.length - 1) await delay(100)
          }
        }
        // No delay needed - retry logic already handles rate limiting
      }
    })()
  ])

  removeElementsByQuery('.asta-extension-badge')
  for (const badge of badges) {
    if (badge.showable === false) {
      continue
    }
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
