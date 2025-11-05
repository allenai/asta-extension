// S2-based reference matching - drop-in replacement for scite API
// Uses Semantic Scholar API instead of api.scite.ai for reference resolution

import { matchReferenceS2 as matchReferenceS2Internal } from './s2-integration'

/**
 * Match a reference using Semantic Scholar API
 * Drop-in replacement for the scite API version in reference-matching.js
 *
 * @param {Object} params
 * @param {string} params.title - Paper title
 * @param {string} params.firstAuthor - First author (currently unused by S2 API)
 * @returns {Promise<{matched: boolean, doi: string|null}>}
 */
export const matchReference = async ({
  title,
  firstAuthor // S2 API doesn't use this, but keep signature compatible
} = {}) => {
  if (!title && !firstAuthor) {
    return { matched: false, doi: null }
  }

  // Call S2 API, requesting both externalIds (contains DOI) and corpusId
  const result = await matchReferenceS2Internal({
    title,
    fields: 'externalIds,corpusId'
  })

  // Extract DOI from S2's externalIds field
  const doi = result?.externalIds?.DOI

  return {
    matched: !!doi,
    doi: doi || null
  }
}
