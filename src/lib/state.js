let _state = { member: null, family: null }

export function setState(patch) {
  _state = { ..._state, ...patch }
}

export function getState() {
  return _state
}