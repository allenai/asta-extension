// Semantic Scholar API integration and identifier handling

const S2_API_URL = 'https://api.semanticscholar.org/graph/v1'

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
  fields = 'corpusId'
} = {}) => {
  if (!title) {
    return null
  }

  const { fetch } = window
  const url = new URL(`${S2_API_URL}/paper/search/match`)

  const params = new URLSearchParams({
    query: title,
    fields
  })
  url.search = params.toString()
  try {
    const result = await fetch(url.href)
    const data = await result.json()
    if (data && data.data && data.data.length) {
      return data.data[0]
    }
    return null
  } catch (e) {
    return null
  }
}

// https://api.semanticscholar.org/api-docs/graph#tag/Paper-Data/operation/post_graph_get_papers
export const matchReferenceS2Batch = async ({
  paperIds,
  fields = 'corpusId'
}) => {
  if (!paperIds || !paperIds.length) {
    return null
  }

  const { fetch } = window
  const url = new URL(`${S2_API_URL}/paper/batch?fields=${fields}`)

  try {
    const response = await fetch(url.href, {
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

export const checkShowable = async (corpusid) => {
  if (!corpusid) {
    return null
  }

  const { fetch } = window
  const url = new URL(`https://mage.allen.ai/isShowable/${corpusid}`)

  try {
    const result = await fetch(url.href)
    const data = await result.json()
    if (data) {
      return data
    }
    return null
  } catch (e) {
    return null
  }
}
