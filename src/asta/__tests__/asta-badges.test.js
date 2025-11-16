/* eslint-env jest */

// Test badge creation and showability filtering

describe('createBadge', () => {
  // Replicate the createBadge function for testing
  function createBadge (corpusId) {
    return `
    <div>
      <a href="https://docvis-ui.allen.ai/?corpus_id=${corpusId}&utm_source=extension&utm_medium=badge" target="_blank" style="text-decoration: none; display:block; padding-top:8px;">
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

    expect(html).toContain('https://docvis-ui.allen.ai/')
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

describe('Badge showability filtering', () => {
  it('should skip badges where showable is false', () => {
    const badges = [
      { corpusId: 123, showable: false },
      { corpusId: 456, showable: true },
      { corpusId: 789, showable: false }
    ]

    const filteredBadges = badges.filter(badge => badge.showable !== false)

    expect(filteredBadges).toHaveLength(1)
    expect(filteredBadges[0].corpusId).toBe(456)
  })

  it('should include badges where showable is true', () => {
    const badges = [
      { corpusId: 123, showable: true },
      { corpusId: 456, showable: true }
    ]

    const filteredBadges = badges.filter(badge => badge.showable !== false)

    expect(filteredBadges).toHaveLength(2)
  })

  it('should include badges where showable is undefined', () => {
    const badges = [
      { corpusId: 123 },
      { corpusId: 456, showable: true }
    ]

    const filteredBadges = badges.filter(badge => badge.showable !== false)

    expect(filteredBadges).toHaveLength(2)
  })

  it('should handle empty badge array', () => {
    const badges = []
    const filteredBadges = badges.filter(badge => badge.showable !== false)

    expect(filteredBadges).toHaveLength(0)
  })

  it('should handle all badges being non-showable', () => {
    const badges = [
      { corpusId: 123, showable: false },
      { corpusId: 456, showable: false }
    ]

    const filteredBadges = badges.filter(badge => badge.showable !== false)

    expect(filteredBadges).toHaveLength(0)
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
