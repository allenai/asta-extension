// Build configuration for different deployment targets
//
// public: experimental production (paperfigureqa.allen.ai)
// internal: AI2 dogfooding (set via INTERNAL_URL env var)

// S2 API URL - required for production builds, defaults to public API for dev
const S2_PUBLIC_API = 'https://api.semanticscholar.org/graph/v1'
const S2_API_URL = process.env.S2_API_URL || (
  process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('S2_API_URL environment variable is required for production builds. Get it from 1Password.') })()
    : S2_PUBLIC_API
)

module.exports = {
  public: {
    ASTA_UI_URL: 'https://paperfigureqa.allen.ai',
    S2_API_URL
  },
  internal: {
    ASTA_UI_URL: process.env.INTERNAL_URL || 'https://paperfigureqa.allen.ai',
    S2_API_URL
  }
}
