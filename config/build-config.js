// Build configuration for different deployment targets
//
// public: experimental production (paperfigureqa.allen.ai)
// internal: AI2 dogfooding (set via INTERNAL_URL env var)

module.exports = {
  public: {
    ASTA_UI_URL: 'https://paperfigureqa.allen.ai'
  },
  internal: {
    ASTA_UI_URL: process.env.INTERNAL_URL || 'https://paperfigureqa.allen.ai'
  }
}
