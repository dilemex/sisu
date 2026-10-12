let _state = { member: null, family: null }

export function setState(patch) {
  _state = { ..._state, ...patch }
}

export function getState() {
  return _state
}
let _pendingNewTransaction = false

export function setPendingNewTransaction(v) {
  _pendingNewTransaction = v
}

export function consumePendingNewTransaction() {
  const v = _pendingNewTransaction
  _pendingNewTransaction = false
  return v
}