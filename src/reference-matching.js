const API_URL = 'https://api.scite.ai'
const S2_API_URL = 'https://api.semanticscholar.org/graph/v1'

export const matchReference = async ({
  title,
  firstAuthor
} = {}) => {
  if (!title && !firstAuthor) {
    return null
  }

  const { fetch } = window
  const url = new URL(`${API_URL}/search/match_reference`)

  const params = new URLSearchParams({
    title,
    first_author: firstAuthor
  })
  url.search = params.toString()
  try {
    const result = await fetch(url)
    const data = await result.json()
    return data
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
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ids: paperIds}),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
    })
    const data = await response.json()
    return data
  } catch (e) {
    return null
  }
}
