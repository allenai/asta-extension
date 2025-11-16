/* global chrome, browser:true */
if (typeof chrome !== 'undefined' && chrome) {
  browser = chrome
}

// Base URL injected at build time based on TARGET environment variable
const ASTA_UI_URL = process.env.ASTA_UI_URL

browser.runtime.onInstalled.addListener(function (details) {
  if (details.reason === 'install') {
    browser.tabs.create({
      url: `${ASTA_UI_URL}/?utm_source=extension&utm_medium=install`
    })
  }
})

browser.action.onClicked.addListener(function (tab) {
  browser.tabs.create({
    url: `${ASTA_UI_URL}/?utm_source=extension&utm_medium=button_click`
  })
})

function onCreated () {
  if (browser.runtime.lastError) {
    console.log(`Error: ${browser.runtime.lastError}`)
  } else {
    console.log('Item created successfully')
  }
}

// Context menu disabled until deep linking available in Asta product
// browser.contextMenus.create({
//   id: 'asta',
//   title: 'Ask Asta',
//   contexts: ['selection']
// }, onCreated)

// browser.contextMenus.onClicked.addListener(function (info, tab) {
//   if (info.menuItemId === 'asta') {
//     if (info.selectionText) {
//       const encodedSelection = encodeURIComponent(
//         `${info.selectionText}`
//       )

//       browser.tabs.create({
//         url: `${ASTA_UI_URL}/?query=${encodedSelection}&utm_source=extension&utm_medium=context`
//       })
//     }
//   }
// })

// Fetch proxy for content scripts (CORS workaround)
// Content scripts can't use host_permissions, so they send requests here
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH') {
    fetch(request.url, request.options)
      .then(response => {
        return response.json().then(data => ({
          ok: response.ok,
          status: response.status,
          data
        })).catch(() => {
          // If JSON parsing fails, still return response info
          return {
            ok: response.ok,
            status: response.status,
            data: null
          }
        })
      })
      .then(sendResponse)
      .catch(error => {
        sendResponse({ ok: false, status: 0, error: error.message })
      })
    return true // Keep message channel open for async response
  }
})
