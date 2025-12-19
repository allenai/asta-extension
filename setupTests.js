import fetchMock from 'jest-fetch-mock'

fetchMock.enableMocks()

// Set test URL for S2 API (tests are mocked, so this is just for URL construction)
process.env.S2_API_URL = 'https://test.example.com/api'
