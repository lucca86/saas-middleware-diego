export function generatePassword() {
  const bytes = new Uint32Array(2)
  crypto.getRandomValues(bytes)
  return `Sc${bytes[0].toString(36)}${bytes[1].toString(36)}!${bytes[0] % 90 + 10}`.slice(0, 20)
}
