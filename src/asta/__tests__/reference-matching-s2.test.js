/* eslint-env jest */
/* global browser */
/* eslint-disable n/no-callback-literal */

// Tests for S2-based matchReference (drop-in replacement for scite API)

import { matchReference } from '../reference-matching-s2'

// Mock browser.runtime for message passing
global.browser = {
  runtime: {
    sendMessage: jest.fn()
  }
}

// Mock S2 API response with externalIds
const s2ResponseWithDOI = {
  data: [
    {
      corpusId: 123456,
      paperId: 'abc123',
      externalIds: {
        DOI: '10.1234/test.doi',
        ArXiv: '2103.12345'
      }
    }
  ]
}

const s2ResponseNoDOI = {
  data: [
    {
      corpusId: 789012,
      paperId: 'def456',
      externalIds: {
        ArXiv: '2104.56789'
      }
    }
  ]
}

const s2ResponseEmpty = {
  data: []
}

beforeEach(() => {
  browser.runtime.sendMessage.mockClear()
})

describe('matchReference (S2-based)', () => {
  it('returns matched:true and DOI when S2 finds paper with DOI', async () => {
    browser.runtime.sendMessage.mockImplementation((request, callback) => {
      callback({ ok: true, data: s2ResponseWithDOI })
    })

    const result = await matchReference({ title: 'Understanding Neural Networks' })

    expect(result).toEqual({ matched: true, doi: '10.1234/test.doi' })
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(1)

    // Verify correct API call
    const call = browser.runtime.sendMessage.mock.calls[0][0]
    expect(call.type).toBe('FETCH')
    expect(call.url).toContain('api.semanticscholar.org/graph/v1/paper/search/match')
    expect(call.url).toContain('fields=externalIds%2CcorpusId')
  })

  it('returns matched:false when S2 finds paper without DOI', async () => {
    browser.runtime.sendMessage.mockImplementation((request, callback) => {
      callback({ ok: true, data: s2ResponseNoDOI })
    })

    const result = await matchReference({ title: 'ArXiv-only Paper' })

    expect(result).toEqual({ matched: false, doi: null })
  })

  it('returns matched:false when S2 finds no papers', async () => {
    browser.runtime.sendMessage.mockImplementation((request, callback) => {
      callback({ ok: true, data: s2ResponseEmpty })
    })

    const result = await matchReference({ title: 'Nonexistent Paper' })

    expect(result).toEqual({ matched: false, doi: null })
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(1)
  })

  it('returns matched:false when no title provided', async () => {
    const result = await matchReference({ title: '' })

    expect(result).toEqual({ matched: false, doi: null })
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(0)
  })

  it('returns matched:false when no params provided', async () => {
    const result = await matchReference({})

    expect(result).toEqual({ matched: false, doi: null })
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(0)
  })

  it('returns matched:false on API error', async () => {
    browser.runtime.sendMessage.mockImplementation((request, callback) => {
      callback({ ok: false, error: 'API error' })
    })

    const result = await matchReference({ title: 'Some Paper' })

    expect(result).toEqual({ matched: false, doi: null })
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(2) // 1 initial + 1 retry
  })

  it('accepts firstAuthor parameter (for API compatibility)', async () => {
    browser.runtime.sendMessage.mockImplementation((request, callback) => {
      callback({ ok: true, data: s2ResponseWithDOI })
    })

    const result = await matchReference({
      title: 'Test Paper',
      firstAuthor: 'Smith'
    })

    expect(result).toEqual({ matched: true, doi: '10.1234/test.doi' })
  })
})
