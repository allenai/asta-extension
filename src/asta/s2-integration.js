// Semantic Scholar API integration and identifier handling

/* global chrome, browser */

const S2_API_URL = 'https://i13p7wsrzb.execute-api.us-west-2.amazonaws.com/prod/graph/v1'

// Get browser API - works in Chrome and tests (Firefox untested)
const getBrowserAPI = () => {
  // In tests: global.browser
  if (typeof global !== 'undefined' && global.browser) {
    return global.browser
  }
  // In Firefox: native browser API (untested)
  if (typeof browser !== 'undefined') {
    return browser
  }
  // In Chrome: chrome API
  if (typeof chrome !== 'undefined') {
    return chrome
  }
  throw new Error('No browser API found')
}

// Helper to use background script for fetching (CORS workaround)
// Content scripts can't use host_permissions in Manifest V3
const bgFetch = async (url, options = {}, retries = 1) => {
  const browserAPI = getBrowserAPI()

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await new Promise((resolve, reject) => {
        browserAPI.runtime.sendMessage(
          { type: 'FETCH', url, options },
          (response) => {
            // Check for runtime errors first
            if (browserAPI.runtime.lastError) {
              reject(new Error(`Runtime error: ${browserAPI.runtime.lastError.message}`))
              return
            }
            // Check if response exists (sendMessage failed)
            if (!response) {
              reject(new Error('No response from background script'))
              return
            }
            // Check if fetch succeeded
            if (response.ok) {
              resolve({ json: async () => response.data, status: response.status })
            } else {
              const error = new Error(response.error || `HTTP ${response.status}`)
              error.status = response.status
              // Don't retry on 4xx errors (except 429 rate limits)
              // Do retry on 429, 5xx, network errors (status 0), and unknown status
              if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                error.retryable = false // Permanent client error
              } else {
                error.retryable = true // Transient or unknown error
              }
              reject(error)
            }
          }
        )
      })
      return response
    } catch (error) {
      // Only retry on transient errors (429, 5xx, network errors)
      const shouldRetry = error.retryable === true && attempt < retries
      if (shouldRetry) {
        // Exponential backoff: 500ms, 1000ms, 2000ms, etc.
        const backoff = 500 * Math.pow(2, attempt)

        // Log transient 429s (will retry)
        if (error.status === 429) {
          console.warn(`[S2] Rate limited (HTTP 429), retrying in ${backoff}ms...`)
        }

        await new Promise(resolve => setTimeout(resolve, backoff))
      } else {
        throw error
      }
    }
  }
}

// Identifier prefixes for non-DOI S2 identifiers
export const s2IdPrefixes = [
  'arxiv',
  'corpusid'
]

export const hasS2Prefix = (doi) => s2IdPrefixes.some(v => doi && doi.toLowerCase().startsWith(`${v}:`))

// Extract ArXiv ID from citation_arxiv_id meta tag
// Returns formatted identifier like "ARXIV:2103.12345"
export const extractArxivId = () => {
  const metas = document.getElementsByTagName('meta')
  let arxivId = null

  Array.from(metas).some(meta => {
    const name = meta.getAttribute('name')
    if (name === 'citation_arxiv_id') {
      const arxivIdCandidate = meta.content.toLowerCase().replace('arxiv:', '').trim()
      arxivId = 'ARXIV:'.concat(arxivIdCandidate)
      return true // stop iterating
    }
    return false // continue iterating
  })

  return arxivId
}

// Extract Corpus ID from Semantic Scholar page
// Returns formatted identifier like "CorpusId:123456"
export const extractCorpusId = () => {
  const corpusIdLink = document.querySelector('[data-test-id="corpus-id"]')
  const corpusIdCandidate = corpusIdLink?.textContent.replace(/\D/g, '')
  if (corpusIdCandidate) {
    return 'CorpusId:'.concat(corpusIdCandidate)
  }
  return null
}

// https://api.semanticscholar.org/api-docs/graph#tag/Paper-Data/operation/get_graph_paper_title_search
export const matchReferenceS2 = async ({
  title,
  fields = 'corpusId,textAvailability'
} = {}) => {
  if (!title) {
    return null
  }

  const url = new URL(`${S2_API_URL}/paper/search/match`)

  const params = new URLSearchParams({
    query: title,
    fields
  })
  url.search = params.toString()
  try {
    const result = await bgFetch(url.href)
    const data = await result.json()
    if (data && data.data && data.data.length) {
      return data.data[0]
    }
    // Paper not in S2 database (empty results with HTTP 200)
    return null
  } catch (e) {
    const status = e.status ? ` (HTTP ${e.status})` : ''

    // Final 429 after retries exhausted
    if (e.status === 429) {
      console.warn(`[S2] Rate limited after retries exhausted: "${title.substring(0, 50)}..." - ${e.message}`)
    } else if (e.status === 404) {
      // 404 - paper not in S2 database
      console.warn(`[S2] Not found${status}: "${title.substring(0, 50)}..." - ${e.message}`)
    } else {
      // Unexpected errors (500, network, etc.)
      console.error(`[S2] API error${status}: "${title.substring(0, 50)}..." - ${e.message}`)
    }

    return null
  }
}

// https://api.semanticscholar.org/api-docs/graph#tag/Paper-Data/operation/post_graph_get_papers
export const matchReferenceS2Batch = async ({
  paperIds,
  fields = 'corpusId,textAvailability'
}) => {
  if (!paperIds || !paperIds.length) {
    return null
  }

  const url = new URL(`${S2_API_URL}/paper/batch?fields=${fields}`)

  try {
    const response = await bgFetch(url.href, {
      method: 'POST',
      body: JSON.stringify({ ids: paperIds }),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    })
    const data = await response.json()
    return data
  } catch (e) {
    return null
  }
}
