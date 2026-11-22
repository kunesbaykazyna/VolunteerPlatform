export default function Avatar({ name = '', src, size = 'md', className = '' }) {
  const initials = (name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join('')
    .toUpperCase()

  return (
    <span className={`avatar avatar-${size} ${className}`} aria-label={name}>
      {src ? <img src={src} alt="" /> : <span aria-hidden="true">{initials || '?'}</span>}
    </span>
  )
}
