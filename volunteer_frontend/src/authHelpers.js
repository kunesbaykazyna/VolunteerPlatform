function cooldownKey(email) {
  return `verification-resend-until:${email.trim().toLowerCase()}`
}

export function getVerificationCooldown(email) {
  return Number(localStorage.getItem(cooldownKey(email)) || 0)
}

export function startVerificationCooldown(email) {
  const until = Date.now() + 60_000
  localStorage.setItem(cooldownKey(email), String(until))
  return until
}
