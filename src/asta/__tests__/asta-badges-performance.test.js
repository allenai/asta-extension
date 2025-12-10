/* eslint-env jest */

// Test for badge insertion guards

import { insertAstaBadges } from '../asta-badges'
import * as s2Integration from '../s2-integration'

// Mock the S2 integration module
jest.mock('../s2-integration')

describe('insertAstaBadges', () => {
  let mockBadgeSite
  let mockFindDoiEls

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Mock DOM
    document.body.innerHTML = '<div id="container"></div>'

    // Create mock citation elements
    const createMockEl = (id) => {
      const el = document.createElement('div')
      el.id = `cite-${id}`
      document.getElementById('container').appendChild(el)
      return el
    }

    // Mock badge site configuration
    mockBadgeSite = {
      name: 'test-site',
      position: 'beforeend'
    }

    s2Integration.matchReferenceS2.mockImplementation((reference) => {
      return new Promise(resolve => {
        setTimeout(() => {
          const id = parseInt(reference.title.split('-')[1])
          resolve({ corpusId: id, textAvailability: 'fulltext' })
        }, 100)
      })
    })

    s2Integration.matchReferenceS2Batch.mockImplementation(({ paperIds }) => {
      return new Promise(resolve => {
        setTimeout(() => {
          const results = paperIds.map(id => ({
            corpusId: parseInt(id.replace('DOI:', '')),
            textAvailability: 'fulltext'
          }))
          resolve(results)
        }, 100)
      })
    })

    // Mock findDoiEls to return papers with and without DOIs
    mockFindDoiEls = jest.fn().mockImplementation(() => [
      { citeEl: createMockEl(1), reference: { title: 'ref-1' } },
      { citeEl: createMockEl(2), reference: { title: 'ref-2' } },
      { citeEl: createMockEl(3), doi: '100' },
      { citeEl: createMockEl(4), doi: '200' }
    ])
  })

  it('prevents concurrent executions with isRunning guard', async () => {
    // Start first execution
    const promise1 = insertAstaBadges(mockBadgeSite, mockFindDoiEls)

    // Try to start second execution while first is running
    const promise2 = insertAstaBadges(mockBadgeSite, mockFindDoiEls)

    await Promise.all([promise1, promise2])

    // Second call should be ignored due to isRunning guard
    // So we should only see calls from first execution (2 refs, 1 batch for 2 DOIs)
    expect(s2Integration.matchReferenceS2).toHaveBeenCalledTimes(2) // Not 4
    expect(s2Integration.matchReferenceS2Batch).toHaveBeenCalledTimes(1) // Not 2
  })
})
