/* global chrome, browser:true */
if (typeof chrome !== 'undefined' && chrome) {
  browser = chrome
}

browser.runtime.onInstalled.addListener(function (details) {
  if (details.reason === 'install') {
    browser.tabs.create({
      url: 'https://nora.allen.ai/chat?utm_source=extension&utm_medium=install'
    })
  }
})

browser.action.onClicked.addListener(function (tab) {
  browser.tabs.create({
    url: 'https://nora.allen.ai/chat?utm_source=extension&utm_medium=button_click'
  })
})

function onCreated () {
  if (browser.runtime.lastError) {
    console.log(`Error: ${browser.runtime.lastError}`)
  } else {
    console.log('Item created successfully')
  }
}

browser.contextMenus.create({
  id: 'nora',
  title: 'Ask Nora',
  contexts: ['selection']
}, onCreated)

browser.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId === 'nora') {
    if (info.selectionText) {
      const encodedSelection = encodeURIComponent(
        `${info.selectionText}`
      )

      browser.tabs.create({
        url: `https://nora.allen.ai/chat?query=${encodedSelection}&utm_source=extension&utm_medium=context`
      })
    }
  }
})
