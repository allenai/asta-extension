/* eslint-env jest */

// Test badge creation and showability filtering

describe('createBadge', () => {
  // Replicate the createBadge function for testing
  function createBadge (corpusId) {
    return `
    <div>
      <a href="https://paperfigureqa.allen.ai/?corpus_id=${corpusId}&utm_source=extension&utm_medium=badge" target="_blank" style="text-decoration: none; display:block; padding-top:8px;">
        <button style="padding: 4px 8px; color: #f0529c; border: 1px solid #f0529c; background-color: #ffffff; border-radius: 4px; cursor: pointer; font-family:manrope, arial, sans-serif;">
          Ask AI about this paper
        </button>
      </a>
    </div>
  `
  }

  it('generates HTML with corpus_id in URL', () => {
    const html = createBadge(123456)

    expect(html).toContain('corpus_id=123456')
  })

  it('includes correct chat URL', () => {
    const html = createBadge(123456)

    expect(html).toContain('https://paperfigureqa.allen.ai/')
  })

  it('includes UTM parameters for tracking', () => {
    const html = createBadge(123456)

    expect(html).toContain('utm_source=extension')
    expect(html).toContain('utm_medium=badge')
  })

  it('includes Ask AI about this paper button text', () => {
    const html = createBadge(123456)

    expect(html).toContain('Ask AI about this paper')
  })

  it('creates button with Asta brand styling', () => {
    const html = createBadge(123456)

    expect(html).toContain('color: #f0529c')
    expect(html).toContain('border: 1px solid #f0529c')
  })

  it('opens link in new tab', () => {
    const html = createBadge(123456)

    expect(html).toContain('target="_blank"')
  })

  it('handles different corpusIds correctly', () => {
    const html1 = createBadge(111111)
    const html2 = createBadge(999999)

    expect(html1).toContain('corpus_id=111111')
    expect(html2).toContain('corpus_id=999999')
  })
})

describe('textAvailability filtering', () => {
  it('should only include papers with fulltext availability', () => {
    const results = [
      { corpusId: 123, textAvailability: 'fulltext' },
      { corpusId: 456, textAvailability: 'abstract' },
      { corpusId: 789, textAvailability: 'none' }
    ]

    const filtered = results.filter(r => r.textAvailability === 'fulltext')

    expect(filtered).toHaveLength(1)
    expect(filtered[0].corpusId).toBe(123)
  })

  it('should exclude papers with no corpusId', () => {
    const results = [
      { corpusId: 123, textAvailability: 'fulltext' },
      { corpusId: null, textAvailability: 'fulltext' },
      { textAvailability: 'fulltext' }
    ]

    const filtered = results.filter(r => r.corpusId && r.textAvailability === 'fulltext')

    expect(filtered).toHaveLength(1)
  })
})

describe('Deduplication logic', () => {
  it('skips exact duplicate papers', () => {
    const papers = [
      { title: 'Attention Is All You Need' },
      { title: 'Attention Is All You Need' }, // Exact duplicate
      { title: 'BERT: Pre-training of Deep Bidirectional Transformers' }
    ]

    const seen = new Set()
    const unique = []

    for (const paper of papers) {
      const key = paper.title || ''
      if (key && !seen.has(key)) {
        seen.add(key)
        unique.push(paper)
      }
    }

    // Should deduplicate exact match
    expect(unique).toHaveLength(2)
    expect(seen.size).toBe(2)
  })

  it('keeps different papers', () => {
    const papers = [
      { title: 'Attention Is All You Need' },
      { title: 'BERT: Pre-training of Deep Bidirectional Transformers' },
      { title: 'GPT-3: Language Models are Few-Shot Learners' }
    ]

    const seen = new Set()
    const unique = []

    for (const paper of papers) {
      const key = paper.title || ''
      if (key && !seen.has(key)) {
        seen.add(key)
        unique.push(paper)
      }
    }

    // All 3 papers are different
    expect(unique).toHaveLength(3)
    expect(seen.size).toBe(3)
  })

  it('skips exact duplicate DOIs', () => {
    const papers = [
      { doi: '10.1234/test.doi' },
      { doi: '10.1234/test.doi' }, // Exact duplicate
      { doi: '10.5678/other.doi' }
    ]

    const seen = new Set()
    const unique = []

    for (const paper of papers) {
      const key = paper.doi || ''
      if (key && !seen.has(key)) {
        seen.add(key)
        unique.push(paper)
      }
    }

    expect(unique).toHaveLength(2)
    expect(seen.size).toBe(2)
  })
})

describe('insertAstaBadges concurrency', () => {
  const { insertAstaBadges } = require('../asta-badges')
  const s2Integration = require('../s2-integration')

  jest.mock('../s2-integration')

  beforeEach(() => {
    jest.clearAllMocks()
    document.body.innerHTML = '<div id="container"></div>'

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
  })

  it('prevents concurrent executions with isRunning guard', async () => {
    const createMockEl = (id) => {
      const el = document.createElement('div')
      el.id = `cite-${id}`
      document.getElementById('container').appendChild(el)
      return el
    }

    const mockBadgeSite = { name: 'test-site', position: 'beforeend' }
    const mockFindDoiEls = jest.fn().mockImplementation(() => [
      { citeEl: createMockEl(1), reference: { title: 'ref-1' } },
      { citeEl: createMockEl(2), reference: { title: 'ref-2' } },
      { citeEl: createMockEl(3), doi: '100' },
      { citeEl: createMockEl(4), doi: '200' }
    ])

    // Start first execution
    const promise1 = insertAstaBadges(mockBadgeSite, mockFindDoiEls)

    // Try to start second execution while first is running
    const promise2 = insertAstaBadges(mockBadgeSite, mockFindDoiEls)

    await Promise.all([promise1, promise2])

    // Second call should be ignored due to isRunning guard
    expect(s2Integration.matchReferenceS2).toHaveBeenCalledTimes(2)
    expect(s2Integration.matchReferenceS2Batch).toHaveBeenCalledTimes(1)
  })
})
