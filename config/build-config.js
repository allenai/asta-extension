// Build configuration for different deployment targets
//
// public: experimental production (docvis-ui.allen.ai)
// internal: AI2 dogfooding (set via INTERNAL_URL env var)

module.exports = {
  public: {
    ASTA_UI_URL: 'https://docvis-ui.allen.ai'
  },
  internal: {
    ASTA_UI_URL: process.env.INTERNAL_URL || 'https://docvis-ui.allen.ai'
  }
}
