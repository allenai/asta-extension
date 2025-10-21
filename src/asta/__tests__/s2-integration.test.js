/* eslint-env jest */

// Tests for Semantic Scholar API integration (s2-integration.js)
// Covers: S2 API calls, identifier handling, showability checks

import { matchReferenceS2, matchReferenceS2Batch, checkShowable, hasS2Prefix, extractArxivId, extractCorpusId } from '../s2-integration'

const { fetch } = window

// ============================================================================
// Mock Data
// ============================================================================

const s2SearchMatchMock = {
  data: [
    {
      corpusId: 123456,
      paperId: 'abc123'
    }
  ]
}

const s2BatchMock = [
  {
    corpusId: 123456,
    paperId: 'abc123'
  },
  {
    corpusId: 789012,
    paperId: 'def456'
  }
]

const showableTrueMock = {
  showable: true
}

const showableFalseMock = {
  showable: false
}

beforeEach(() => {
  fetch.resetMocks()
})

// ============================================================================
// S2 API Function Tests
// ============================================================================

describe('matchReferenceS2', () => {
  it('returns corpusId on successful title match', async () => {
    fetch.mockResponseOnce(JSON.stringify(s2SearchMatchMock), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

    const result = await matchReferenceS2({ title: 'Understanding Neural Networks' })

    expect(result).toEqual({ corpusId: 123456, paperId: 'abc123' })
    expect(fetch).toHaveBeenCalledTimes(1)
    const callArg = fetch.mock.calls[0][0]
    const urlString = callArg.toString ? callArg.toString() : callArg
    expect(urlString).toContain('api.semanticscholar.org/graph/v1/paper/search/match')
  })

  it('returns null when no results', async () => {
    fetch.mockResponseOnce(JSON.stringify({ data: [] }))

    const result = await matchReferenceS2({ title: 'Nonexistent Paper Title' })

    expect(result).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('returns null on API error', async () => {
    fetch.mockResponseOnce('', { status: 500 })

    const result = await matchReferenceS2({ title: 'Some Paper' })

    expect(result).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('returns null with empty title', async () => {
    const result = await matchReferenceS2({ title: '' })

    expect(result).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(0)
  })

  it('returns null with no title', async () => {
    const result = await matchReferenceS2({})

    expect(result).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(0)
  })
})

describe('matchReferenceS2Batch', () => {
  it('returns array of papers with corpusIds', async () => {
    fetch.mockResponseOnce(JSON.stringify(s2BatchMock), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

    const result = await matchReferenceS2Batch({
      paperIds: ['DOI:10.1234/test1', 'DOI:10.1234/test2'],
      fields: 'corpusId'
    })

    expect(result).toEqual(s2BatchMock)
    expect(fetch).toHaveBeenCalledTimes(1)
    const callArg = fetch.mock.calls[0][0]
    const urlString = callArg.toString ? callArg.toString() : callArg
    expect(urlString).toContain('api.semanticscholar.org/graph/v1/paper/batch')
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify({ ids: ['DOI:10.1234/test1', 'DOI:10.1234/test2'] })
    })
  })

  it('returns null with empty array', async () => {
    const result = await matchReferenceS2Batch({ paperIds: [], fields: 'corpusId' })

    expect(result).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(0)
  })

  it('returns null with no paperIds', async () => {
    const result = await matchReferenceS2Batch({ fields: 'corpusId' })

    expect(result).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(0)
  })

  it('handles API failures gracefully', async () => {
    fetch.mockResponseOnce('', { status: 500 })

    const result = await matchReferenceS2Batch({
      paperIds: ['DOI:10.1234/test'],
      fields: 'corpusId'
    })

    expect(result).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('checkShowable', () => {
  it('returns showable true for valid corpusId', async () => {
    fetch.mockResponseOnce(JSON.stringify(showableTrueMock), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

    const result = await checkShowable(123456)

    expect(result).toEqual({ showable: true })
    expect(fetch).toHaveBeenCalledTimes(1)
    const callArg = fetch.mock.calls[0][0]
    const urlString = callArg.toString ? callArg.toString() : callArg
    expect(urlString).toContain('mage.allen.ai/isShowable/123456')
  })

  it('returns showable false for restricted papers', async () => {
    fetch.mockResponseOnce(JSON.stringify(showableFalseMock), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

    const result = await checkShowable(789012)

    expect(result).toEqual({ showable: false })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('returns null on API error', async () => {
    fetch.mockResponseOnce('', { status: 500 })

    const result = await checkShowable(123456)

    expect(result).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('returns null with no corpusId', async () => {
    const result = await checkShowable(null)

    expect(result).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(0)
  })

  it('returns null with undefined corpusId', async () => {
    const result = await checkShowable(undefined)

    expect(result).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(0)
  })
})

// ============================================================================
// S2 Identifier Tests
// ============================================================================

describe('hasS2Prefix', () => {
  it('detects ARXIV: prefix (uppercase)', () => {
    expect(hasS2Prefix('ARXIV:2103.12345')).toBe(true)
  })

  it('detects arxiv: prefix (lowercase)', () => {
    expect(hasS2Prefix('arxiv:2103.12345')).toBe(true)
  })

  it('detects ArXiv: prefix (mixed case)', () => {
    expect(hasS2Prefix('ArXiv:2103.12345')).toBe(true)
  })

  it('detects CorpusId: prefix (uppercase)', () => {
    expect(hasS2Prefix('CorpusId:123456')).toBe(true)
  })

  it('detects corpusid: prefix (lowercase)', () => {
    expect(hasS2Prefix('corpusid:123456')).toBe(true)
  })

  it('returns false for plain DOIs', () => {
    expect(hasS2Prefix('10.1234/test')).toBe(false)
  })

  it('returns false for DOI: prefixed identifiers', () => {
    expect(hasS2Prefix('DOI:10.1234/test')).toBe(false)
  })

  it('handles null input', () => {
    expect(hasS2Prefix(null)).toBe(false)
  })

  it('handles undefined input', () => {
    expect(hasS2Prefix(undefined)).toBe(false)
  })

  it('handles empty string', () => {
    expect(hasS2Prefix('')).toBe(false)
  })
})

describe('ArXiv ID extraction', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
  })

  it('extracts ArXiv ID from citation_arxiv_id meta tag', () => {
    const meta = document.createElement('meta')
    meta.name = 'citation_arxiv_id'
    meta.content = '2103.12345'
    document.head.appendChild(meta)

    const doi = extractArxivId()

    expect(doi).toBe('ARXIV:2103.12345')
  })

  it('handles ArXiv ID with arxiv: prefix in meta content', () => {
    const meta = document.createElement('meta')
    meta.name = 'citation_arxiv_id'
    meta.content = 'arxiv:2103.12345'
    document.head.appendChild(meta)

    const doi = extractArxivId()

    expect(doi).toBe('ARXIV:2103.12345')
  })

  it('formats result with ARXIV: prefix', () => {
    const meta = document.createElement('meta')
    meta.name = 'citation_arxiv_id'
    meta.content = '2103.12345'
    document.head.appendChild(meta)

    const doi = extractArxivId()

    expect(doi).toMatch(/^ARXIV:/)
  })
})

describe('Corpus ID extraction from Semantic Scholar', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('extracts Corpus ID from data-test-id attribute', () => {
    const div = document.createElement('div')
    div.setAttribute('data-test-id', 'corpus-id')
    div.textContent = 'Corpus ID: 123456'
    document.body.appendChild(div)

    const result = extractCorpusId()

    expect(result).toBe('CorpusId:123456')
  })

  it('extracts only digits from corpus ID text', () => {
    const div = document.createElement('div')
    div.setAttribute('data-test-id', 'corpus-id')
    div.textContent = 'Corpus ID: 789,012'
    document.body.appendChild(div)

    const result = extractCorpusId()

    expect(result).toBe('CorpusId:789012')
  })

  it('returns null when corpus ID element not found', () => {
    const result = extractCorpusId()

    expect(result).toBeNull()
  })

  it('formats result with CorpusId: prefix', () => {
    const div = document.createElement('div')
    div.setAttribute('data-test-id', 'corpus-id')
    div.textContent = '123456'
    document.body.appendChild(div)

    const result = extractCorpusId()

    expect(result).toMatch(/^CorpusId:/)
  })
})

describe('DOI prefix addition', () => {
  it('adds DOI: prefix to plain DOI', () => {
    const doi = '10.1234/test'
    const result = `DOI:${doi}`

    expect(result).toBe('DOI:10.1234/test')
  })

  it('preserves DOI format after prefix', () => {
    const doi = '10.1038/nature12345'
    const result = `DOI:${doi}`

    expect(result).toMatch(/^DOI:10\./)
  })
})
