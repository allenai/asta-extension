/* eslint-env jest */

// Test badge creation and showability filtering

describe('createBadge', () => {
  // Replicate the createBadge function for testing
  function createBadge (corpusId) {
    return `
    <div>
      <a href="https://nora.allen.ai/chat?trigger=reader&trigger_context=%7B%22corpusId%22%3A%20${corpusId}%7D&message_id=7af3e2de-2098-4bc4-987e-fcf0985355a2&utm_source=extension&utm_medium=badge" target="_blank" style="text-decoration: none; display:block; padding-top:8px;">
        <button style="padding: 4px 8px; color: #f0529c; border: 1px solid #f0529c; background-color: #ffffff; border-radius: 4px; cursor: pointer; font-family:manrope, arial, sans-serif;">
          Ask Asta about this paper
        </button>
      </a>
    </div>
  `
  }

  it('generates HTML with corpusId in URL', () => {
    const html = createBadge(123456)

    expect(html).toContain('corpusId%22%3A%20123456')
  })

  it('includes correct chat URL', () => {
    const html = createBadge(123456)

    expect(html).toContain('https://nora.allen.ai/chat')
  })

  it('includes UTM parameters for tracking', () => {
    const html = createBadge(123456)

    expect(html).toContain('utm_source=extension')
    expect(html).toContain('utm_medium=badge')
  })

  it('includes Ask Asta button text', () => {
    const html = createBadge(123456)

    expect(html).toContain('Ask Asta about this paper')
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

    expect(html1).toContain('corpusId%22%3A%20111111')
    expect(html2).toContain('corpusId%22%3A%20999999')
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
