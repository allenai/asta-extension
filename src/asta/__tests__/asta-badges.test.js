/* eslint-env jest */

// Test badge creation and showability filtering

describe('createBadge', () => {
  // Replicate the createBadge function for testing
  function createBadge (corpusId) {
    return `
    <div>
      <a href="https://paperfigureqa.allen.ai/?corpus_id=${corpusId}&utm_source=extension&utm_medium=badge" target="_blank" style="text-decoration: none; display:block; padding-top:8px;">
        <button style="padding: 4px 8px; color: #ffffff; border: 1px solid #3ABA87; background-color: #3ABA87; border-radius: 4px; cursor: pointer; font-family:manrope, arial, sans-serif;">
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

    expect(html).toContain('color: #ffffff')
    expect(html).toContain('background-color: #3ABA87')
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

describe('insertAstaBadges', () => {
  const { insertAstaBadges } = require('../asta-badges')
  const s2Integration = require('../s2-integration')

  jest.mock('../s2-integration')

  beforeEach(() => {
    jest.clearAllMocks()
    document.body.innerHTML = '<div id="container"></div>'

    s2Integration.matchReferenceS2.mockResolvedValue({ corpusId: 123, textAvailability: 'fulltext' })
    s2Integration.matchReferenceS2Batch.mockResolvedValue([{ corpusId: 456, textAvailability: 'fulltext' }])
  })

  it('only inserts badges for papers with fulltext availability', async () => {
    s2Integration.matchReferenceS2
      .mockResolvedValueOnce({ corpusId: 111, textAvailability: 'fulltext' })
      .mockResolvedValueOnce({ corpusId: 222, textAvailability: 'abstract' })
      .mockResolvedValueOnce({ corpusId: 333, textAvailability: 'none' })

    const container = document.getElementById('container')
    const mockFindDoiEls = () => [
      { citeEl: container.appendChild(document.createElement('div')), reference: { title: 'Paper 1' } },
      { citeEl: container.appendChild(document.createElement('div')), reference: { title: 'Paper 2' } },
      { citeEl: container.appendChild(document.createElement('div')), reference: { title: 'Paper 3' } }
    ]

    await insertAstaBadges({ name: 'test', position: 'beforeend' }, mockFindDoiEls)

    const badges = document.querySelectorAll('.asta-extension-badge')
    expect(badges).toHaveLength(1) // Only fulltext paper gets a badge
  })

  it('skips duplicate titles - only calls API once per unique title', async () => {
    const container = document.getElementById('container')
    const mockFindDoiEls = () => [
      { citeEl: container.appendChild(document.createElement('div')), reference: { title: 'Same Paper' } },
      { citeEl: container.appendChild(document.createElement('div')), reference: { title: 'Same Paper' } }
    ]

    await insertAstaBadges({ name: 'test', position: 'beforeend' }, mockFindDoiEls)

    expect(s2Integration.matchReferenceS2).toHaveBeenCalledTimes(1)
  })

  it('skips duplicate DOIs - only calls batch API once per unique DOI', async () => {
    const container = document.getElementById('container')
    const mockFindDoiEls = () => [
      { citeEl: container.appendChild(document.createElement('div')), doi: '10.1234/same' },
      { citeEl: container.appendChild(document.createElement('div')), doi: '10.1234/same' }
    ]

    await insertAstaBadges({ name: 'test', position: 'beforeend' }, mockFindDoiEls)

    // Batch is called once with 1 unique DOI
    expect(s2Integration.matchReferenceS2Batch).toHaveBeenCalledTimes(1)
    expect(s2Integration.matchReferenceS2Batch).toHaveBeenCalledWith({
      paperIds: ['DOI:10.1234/same']
    })
  })

  it('prevents concurrent executions with isRunning guard', async () => {
    // Use delayed mocks to simulate async API calls
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

    const container = document.getElementById('container')
    const mockFindDoiEls = jest.fn().mockImplementation(() => [
      { citeEl: container.appendChild(document.createElement('div')), reference: { title: 'ref-1' } },
      { citeEl: container.appendChild(document.createElement('div')), reference: { title: 'ref-2' } },
      { citeEl: container.appendChild(document.createElement('div')), doi: '100' },
      { citeEl: container.appendChild(document.createElement('div')), doi: '200' }
    ])

    // Start first execution
    const promise1 = insertAstaBadges({ name: 'test', position: 'beforeend' }, mockFindDoiEls)

    // Try to start second execution while first is running
    const promise2 = insertAstaBadges({ name: 'test', position: 'beforeend' }, mockFindDoiEls)

    await Promise.all([promise1, promise2])

    // Second call should be ignored due to isRunning guard
    expect(s2Integration.matchReferenceS2).toHaveBeenCalledTimes(2)
    expect(s2Integration.matchReferenceS2Batch).toHaveBeenCalledTimes(1)
  })
})
