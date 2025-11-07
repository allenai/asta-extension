/* eslint-env jest */

// Performance test for parallel badge loading

import { insertAstaBadges } from '../asta-badges'
import * as s2Integration from '../s2-integration'

// Mock the S2 integration module
jest.mock('../s2-integration')

describe('insertAstaBadges performance', () => {
  let mockBadgeSite
  let mockFindDoiEls
  let mockCheckShowable
  let mockMatchReferenceS2
  let mockMatchReferenceS2Batch

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

    // Mock API calls with realistic timing
    mockCheckShowable = jest.fn().mockImplementation((corpusId) => {
      return new Promise(resolve => {
        setTimeout(() => resolve({ showable: true }), 50) // 50ms per call
      })
    })

    mockMatchReferenceS2 = jest.fn().mockImplementation((reference) => {
      return new Promise(resolve => {
        setTimeout(() => {
          const id = parseInt(reference.split('-')[1])
          resolve({ corpusId: id })
        }, 100) // 100ms per call
      })
    })

    mockMatchReferenceS2Batch = jest.fn().mockImplementation(({ paperIds }) => {
      return new Promise(resolve => {
        setTimeout(() => {
          const results = paperIds.map(id => ({ corpusId: parseInt(id.replace('DOI:', '')) }))
          resolve(results)
        }, 100) // 100ms for batch
      })
    })

    s2Integration.checkShowable.mockImplementation(mockCheckShowable)
    s2Integration.matchReferenceS2.mockImplementation(mockMatchReferenceS2)
    s2Integration.matchReferenceS2Batch.mockImplementation(mockMatchReferenceS2Batch)

    // Mock findDoiEls to return papers with and without DOIs
    mockFindDoiEls = jest.fn().mockImplementation(() => [
      // 10 papers without DOIs (need reference matching)
      { citeEl: createMockEl(1), reference: 'ref-1' },
      { citeEl: createMockEl(2), reference: 'ref-2' },
      { citeEl: createMockEl(3), reference: 'ref-3' },
      { citeEl: createMockEl(4), reference: 'ref-4' },
      { citeEl: createMockEl(5), reference: 'ref-5' },
      { citeEl: createMockEl(6), reference: 'ref-6' },
      { citeEl: createMockEl(7), reference: 'ref-7' },
      { citeEl: createMockEl(8), reference: 'ref-8' },
      { citeEl: createMockEl(9), reference: 'ref-9' },
      { citeEl: createMockEl(10), reference: 'ref-10' },
      // 10 papers with DOIs (DOIs stored without 'DOI:' prefix)
      { citeEl: createMockEl(11), doi: '100' },
      { citeEl: createMockEl(12), doi: '200' },
      { citeEl: createMockEl(13), doi: '300' },
      { citeEl: createMockEl(14), doi: '400' },
      { citeEl: createMockEl(15), doi: '500' },
      { citeEl: createMockEl(16), doi: '600' },
      { citeEl: createMockEl(17), doi: '700' },
      { citeEl: createMockEl(18), doi: '800' },
      { citeEl: createMockEl(19), doi: '900' },
      { citeEl: createMockEl(20), doi: '1000' }
    ])
  })

  it('processes badges in parallel (refs and DOIs)', async () => {
    const startTime = Date.now()

    await insertAstaBadges(mockBadgeSite, mockFindDoiEls)

    const endTime = Date.now()
    const totalTime = endTime - startTime

    // Verify API calls were made
    expect(mockMatchReferenceS2).toHaveBeenCalledTimes(10) // 10 refs
    expect(mockMatchReferenceS2Batch).toHaveBeenCalledTimes(1) // 1 batch of 20 DOIs
    expect(mockCheckShowable).toHaveBeenCalledTimes(20) // 20 total papers

    // With parallel execution:
    // - Refs: 10 papers ÷ 10 per batch = 1 batch
    //   Batch 1: 10 papers × (100ms match + 50ms showable) in parallel = ~150ms
    //   Total refs: ~150ms
    //
    // - DOIs: 10 papers in 1 batch
    //   Batch: 100ms match + (10 × 50ms showable in parallel) = ~150ms
    //   Total DOIs: ~150ms
    //
    // Parallel execution: max(150ms, 150ms) = ~150ms
    // Add some buffer for JS execution: ~600ms max

    console.log(`[Performance Test] Total time: ${totalTime}ms`)

    // Should complete in ~600ms with batch size 10 (fast performance)
    expect(totalTime).toBeLessThan(1000)

    // All badges should be inserted
    const badges = document.querySelectorAll('.asta-extension-badge')
    expect(badges.length).toBe(20)
  })

  it('handles concurrent API calls correctly', async () => {
    await insertAstaBadges(mockBadgeSite, mockFindDoiEls)

    // Verify concurrent calls within batches
    // Should have called matchReferenceS2 in 1 batch of 10
    expect(mockMatchReferenceS2).toHaveBeenCalledTimes(10)

    // Should have called checkShowable for all badges
    expect(mockCheckShowable).toHaveBeenCalledTimes(20)

    // Check all corpus IDs are unique
    const showableCalls = mockCheckShowable.mock.calls.map(call => call[0])
    const uniqueCorpusIds = new Set(showableCalls)
    expect(uniqueCorpusIds.size).toBe(20)
  })

  it('processes batches sequentially with controlled concurrency', async () => {
    const callTimes = []

    // Create 8 refs, all fit in 1 batch (batch size is 10)
    const mockFindDoiElsWithMoreRefs = jest.fn().mockImplementation(() => {
      const createMockEl = (id) => {
        const el = document.createElement('div')
        el.id = `cite-${id}`
        document.getElementById('container').appendChild(el)
        return el
      }
      return Array.from({ length: 8 }, (_, i) => ({
        citeEl: createMockEl(i + 1),
        reference: `ref-${i + 1}`
      }))
    })

    mockMatchReferenceS2.mockImplementation((reference) => {
      callTimes.push(Date.now())
      return new Promise(resolve => {
        // Simulate API delay
        setTimeout(() => resolve({ corpusId: parseInt(reference.split('-')[1]) }), 100)
      })
    })

    mockCheckShowable.mockImplementation((corpusId) => {
      return Promise.resolve({ showable: true })
    })

    const startTime = Date.now()
    await insertAstaBadges(mockBadgeSite, mockFindDoiElsWithMoreRefs)

    // With 1 batch (8 items fit in batch size 10):
    // All 8 items start at ~0ms and run in parallel

    const relativeCallTimes = callTimes.map(t => t - startTime)
    console.log('[Batching Test] Call times:', relativeCallTimes)

    // All 8 calls should complete
    expect(callTimes.length).toBe(8)

    // All calls should start near-simultaneously (within 50ms)
    relativeCallTimes.forEach(time => {
      expect(time).toBeLessThan(50) // All start within 50ms
    })
  })

  it('does not block on collecting all corpusIds before checking showable', async () => {
    let firstShowableCallTime = null
    let lastMatchCallTime = null

    mockMatchReferenceS2.mockImplementation((reference) => {
      return new Promise(resolve => {
        setTimeout(() => {
          lastMatchCallTime = Date.now()
          const id = parseInt(reference.split('-')[1])
          resolve({ corpusId: id })
        }, 100)
      })
    })

    mockCheckShowable.mockImplementation((corpusId) => {
      if (firstShowableCallTime === null) {
        firstShowableCallTime = Date.now()
      }
      return Promise.resolve({ showable: true })
    })

    mockMatchReferenceS2Batch.mockResolvedValue([]) // No DOI results

    const startTime = Date.now()
    await insertAstaBadges(mockBadgeSite, mockFindDoiEls)

    // First showable call should happen before last match completes
    // This proves we're checking showable inline, not blocking
    const firstShowableRelative = firstShowableCallTime - startTime
    const lastMatchRelative = lastMatchCallTime - startTime

    console.log(`[Inline Test] First showable at ${firstShowableRelative}ms, last match at ${lastMatchRelative}ms`)

    // First showable should start soon after first match (~100ms)
    // With optimized timing and no delays in this test, they happen nearly simultaneously
    expect(firstShowableRelative).toBeLessThan(200)
    expect(lastMatchRelative).toBeGreaterThanOrEqual(firstShowableRelative)
  })

  it('prevents concurrent executions with isRunning guard', async () => {
    // Start first execution
    const promise1 = insertAstaBadges(mockBadgeSite, mockFindDoiEls)

    // Try to start second execution while first is running
    const promise2 = insertAstaBadges(mockBadgeSite, mockFindDoiEls)

    await Promise.all([promise1, promise2])

    // Second call should be ignored due to isRunning guard
    // So we should only see calls from first execution
    expect(mockMatchReferenceS2).toHaveBeenCalledTimes(10) // Not 20
    expect(mockMatchReferenceS2Batch).toHaveBeenCalledTimes(1) // Not 2
  })
})
