const dataChangedEvent = 'securecloud:data-changed'

export function notifyDataChanged() {
  window.dispatchEvent(new Event(dataChangedEvent))
}

export function subscribeToDataChanges(callback: () => void) {
  window.addEventListener(dataChangedEvent, callback)
  return () => window.removeEventListener(dataChangedEvent, callback)
}
