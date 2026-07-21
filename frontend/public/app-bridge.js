(() => {
  const requested = new URLSearchParams(window.location.search).get('view') || 'search'
  const labels = {
    tracking: 'Live tracking',
    trips: 'My trips',
    support: 'Support',
    operations: 'Operations',
    search: 'Search'
  }
  const label = labels[requested] || labels.search
  let attempts = 0
  const openRequestedView = () => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const button = buttons.find(item => (item.textContent || '').trim().includes(label))
    if (button) {
      button.click()
      return
    }
    attempts += 1
    if (attempts < 40) window.setTimeout(openRequestedView, 100)
  }
  window.addEventListener('DOMContentLoaded', openRequestedView)
})()
