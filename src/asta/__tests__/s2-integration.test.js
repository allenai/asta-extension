/* eslint-env jest */
/* global browser */
/* eslint-disable n/no-callback-literal */

// Tests for Semantic Scholar API integration (s2-integration.js)
// Covers: S2 API calls, identifier handling, showability checks

import { matchReferenceS2, matchReferenceS2Batch, hasS2Prefix, extractArxivId, extractCorpusId } from '../s2-integration'

// Mock browser.runtime for message passing
global.browser = {
  runtime: {
    sendMessage: jest.fn()
  }
}

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

beforeEach(() => {
  browser.runtime.sendMessage.mockClear()
})

// ============================================================================
// S2 API Function Tests
// ============================================================================

describe('matchReferenceS2', () => {
  it('returns corpusId on successful title match', async () => {
    browser.runtime.sendMessage.mockImplementation((request, callback) => {
      callback({ ok: true, data: s2SearchMatchMock })
    })

    const result = await matchReferenceS2({ title: 'Understanding Neural Networks' })

    expect(result).toEqual({ corpusId: 123456, paperId: 'abc123' })
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(1)
    const call = browser.runtime.sendMessage.mock.calls[0][0]
    expect(call.type).toBe('FETCH')
    expect(call.url).toContain('REDACTED/prod/graph/v1/paper/search/match')
  })

  it('returns null when no results', async () => {
    browser.runtime.sendMessage.mockImplementation((request, callback) => {
      callback({ ok: true, data: { data: [] } })
    })

    const result = await matchReferenceS2({ title: 'Nonexistent Paper Title' })

    expect(result).toBeNull()
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(1)
  })

  it('returns null on API error', async () => {
    browser.runtime.sendMessage.mockImplementation((request, callback) => {
      callback({ ok: false, error: 'API error' })
    })

    const result = await matchReferenceS2({ title: 'Some Paper' })

    expect(result).toBeNull()
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(2)
  })

  it('returns null with empty title', async () => {
    const result = await matchReferenceS2({ title: '' })

    expect(result).toBeNull()
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(0)
  })

  it('returns null with no title', async () => {
    const result = await matchReferenceS2({})

    expect(result).toBeNull()
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(0)
  })
})

describe('matchReferenceS2Batch', () => {
  it('returns array of papers with corpusIds', async () => {
    browser.runtime.sendMessage.mockImplementation((request, callback) => {
      callback({ ok: true, data: s2BatchMock })
    })

    const result = await matchReferenceS2Batch({
      paperIds: ['DOI:10.1234/test1', 'DOI:10.1234/test2'],
      fields: 'corpusId'
    })

    expect(result).toEqual(s2BatchMock)
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(1)
    const call = browser.runtime.sendMessage.mock.calls[0][0]
    expect(call.type).toBe('FETCH')
    expect(call.url).toContain('REDACTED/prod/graph/v1/paper/batch')
    expect(call.options).toMatchObject({
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
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(0)
  })

  it('returns null with no paperIds', async () => {
    const result = await matchReferenceS2Batch({ fields: 'corpusId' })

    expect(result).toBeNull()
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(0)
  })

  it('handles API failures gracefully', async () => {
    browser.runtime.sendMessage.mockImplementation((request, callback) => {
      callback({ ok: false, error: 'API error' })
    })

    const result = await matchReferenceS2Batch({
      paperIds: ['DOI:10.1234/test'],
      fields: 'corpusId'
    })

    expect(result).toBeNull()
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(2)
  })
})

// ============================================================================
// Retry Logic Tests (Critical for CORS fix)
// ============================================================================

describe('bgFetch retry logic', () => {
  it('does NOT retry on 404 errors (permanent)', async () => {
    browser.runtime.sendMessage.mockImplementation((request, callback) => {
      callback({ ok: false, status: 404, error: 'Not Found' })
    })

    const result = await matchReferenceS2({ title: 'Nonexistent Paper' })

    expect(result).toBeNull()
    // Should only try once - 404 is permanent, no retry
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(1)
  })

  it('DOES retry on 429 errors (rate limit)', async () => {
    let callCount = 0
    browser.runtime.sendMessage.mockImplementation((request, callback) => {
      callCount++
      if (callCount === 1) {
        // First call gets rate limited
        callback({ ok: false, status: 429, error: 'Rate Limited' })
      } else {
        // Retry succeeds
        callback({ ok: true, data: s2SearchMatchMock })
      }
    })

    const result = await matchReferenceS2({ title: 'Some Paper' })

    expect(result).toEqual({ corpusId: 123456, paperId: 'abc123' })
    // Should try twice - 429 is transient, retry once
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(2)
  })

  it('DOES retry on 500 errors (server error)', async () => {
    let callCount = 0
    browser.runtime.sendMessage.mockImplementation((request, callback) => {
      callCount++
      if (callCount === 1) {
        callback({ ok: false, status: 500, error: 'Internal Server Error' })
      } else {
        callback({ ok: true, data: s2SearchMatchMock })
      }
    })

    const result = await matchReferenceS2({ title: 'Some Paper' })

    expect(result).toEqual({ corpusId: 123456, paperId: 'abc123' })
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(2)
  })

  it('DOES retry on network errors (status 0)', async () => {
    let callCount = 0
    browser.runtime.sendMessage.mockImplementation((request, callback) => {
      callCount++
      if (callCount === 1) {
        callback({ ok: false, status: 0, error: 'Network error' })
      } else {
        callback({ ok: true, data: s2SearchMatchMock })
      }
    })

    const result = await matchReferenceS2({ title: 'Some Paper' })

    expect(result).toEqual({ corpusId: 123456, paperId: 'abc123' })
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry on 400 errors (bad request)', async () => {
    browser.runtime.sendMessage.mockImplementation((request, callback) => {
      callback({ ok: false, status: 400, error: 'Bad Request' })
    })

    const result = await matchReferenceS2({ title: 'Some Paper' })

    expect(result).toBeNull()
    // 400 is permanent client error, no retry
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(1)
  })

  it('gives up after max retries on persistent 429', async () => {
    browser.runtime.sendMessage.mockImplementation((request, callback) => {
      // Always return 429
      callback({ ok: false, status: 429, error: 'Rate Limited' })
    })

    // Should return null after retries exhausted (just logs and gives up)
    const result = await matchReferenceS2({ title: 'Some Paper' })

    expect(result).toBeNull()
    // Should try initial + 1 retry = 2 total
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(2)
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
