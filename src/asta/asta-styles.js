// Shared Asta button styles - used by both popup and badge

export const ASTA_BUTTON_STYLES = {
  padding: '4px 8px',
  color: '#ffffff',
  border: '1px solid #3ABA87',
  backgroundColor: '#3ABA87',
  borderRadius: '4px',
  cursor: 'pointer',
  fontFamily: 'manrope, arial, sans-serif',
  fontSize: '14px'
}

// Convert style object to inline CSS string for template literals
export const ASTA_BUTTON_STYLE_STRING = Object.entries(ASTA_BUTTON_STYLES)
  .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
  .join('; ')

export const ASTA_LINK_STYLES = {
  textDecoration: 'none',
  display: 'inline-block'
}

export const ASTA_LINK_STYLE_STRING = Object.entries(ASTA_LINK_STYLES)
  .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
  .join('; ')
