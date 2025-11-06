// Asta "Ask about this paper" badge integration
import { matchReferenceS2, matchReferenceS2Batch, checkShowable } from './s2-integration'
import { sliceIntoChunks } from '../util'

const ASTA_CHAT_BASE_URL = 'https://nora.allen.ai/chat?trigger=reader&trigger_context=%7B%22corpusId%22%3A%20'
const ASTA_CHAT_PARAMS = '%7D&message_id=7af3e2de-2098-4bc4-987e-fcf0985355a2&utm_source=extension&utm_medium=badge'

const buildAstaChatUrl = (corpusId) => `${ASTA_CHAT_BASE_URL}${corpusId}${ASTA_CHAT_PARAMS}`

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

// This function will be called by the main extension to insert Asta badges
// It reuses the same BADGE_SITES structure from badges.js
export async function insertAstaBadges (badgeSite, findDoiEls) {
  if (!badgeSite) {
    return
  }

  // Remove old Asta badges
  removeElementsByQuery('.asta-extension-badge')

  const els = findDoiEls()
  if (!els || els.length <= 0) {
    return
  }

  const refsToResolve = []
  const badgesWithDOIs = []
  for (const el of els) {
    if (el.doi) {
      badgesWithDOIs.push(el)
    } else {
      refsToResolve.push(el)
    }
  }

  const badges = []

  //
  // Resolve references up to 20 at a time
  //
  const jobs = sliceIntoChunks(refsToResolve, 20)
  for (const batch of jobs) {
    await Promise.all(batch.map(async el => {
      const result = await matchReferenceS2(el.reference)
      if (result?.corpusId) {
        badges.push({
          ...el,
          corpusId: result.corpusId
        })
      }
    }))
  }

  const jobs2 = sliceIntoChunks(badgesWithDOIs, 20)
  for (const batch of jobs2) {
    const result = await matchReferenceS2Batch({
      paperIds: batch.map(badge => `DOI:${badge.doi}`),
      fields: 'corpusId'
    })
    // check that result is an array and it is the same length as batch
    if (Array.isArray(result) && result.length === batch.length) {
      for (let i = 0; i < result.length; i++) {
        if (result[i] && result[i].corpusId) {
          badges.push({
            ...batch[i],
            corpusId: result[i].corpusId
          })
        }
      }
    }
  }

  // Check showable badges 20 at a times
  const jobs3 = sliceIntoChunks(badges, 20)
  for (const batch of jobs3) {
    await Promise.all(batch.map(async badge => {
      const result = await checkShowable(badge.corpusId)
      if (result) {
        badge.showable = result.showable
      }
    })
    )
  }

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
}
