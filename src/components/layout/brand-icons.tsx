// o lucide não tem ícones de marcas, então os SVGs ficam aqui
type IconProps = { className?: string }

function createIcon(path: string) {
  return function Icon({ className }: IconProps) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d={path} />
      </svg>
    )
  }
}

export const FacebookIcon = createIcon('M14 8h3V4h-3c-2.8 0-4 1.7-4 4.3V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6Z')
export const InstagramIcon = createIcon(
  'M12 7.3A4.7 4.7 0 1 0 12 16.7 4.7 4.7 0 0 0 12 7.3Zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm6-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0ZM16.5 2h-9A5.5 5.5 0 0 0 2 7.5v9A5.5 5.5 0 0 0 7.5 22h9a5.5 5.5 0 0 0 5.5-5.5v-9A5.5 5.5 0 0 0 16.5 2Zm3.8 14.5a3.8 3.8 0 0 1-3.8 3.8h-9a3.8 3.8 0 0 1-3.8-3.8v-9a3.8 3.8 0 0 1 3.8-3.8h9a3.8 3.8 0 0 1 3.8 3.8v9Z',
)
export const TwitterIcon = createIcon(
  'M22 5.9c-.7.3-1.5.5-2.3.6a4 4 0 0 0 1.8-2.2c-.8.5-1.7.8-2.6 1a4 4 0 0 0-6.9 3.7A11.4 11.4 0 0 1 3.7 4.8a4 4 0 0 0 1.2 5.4c-.6 0-1.3-.2-1.8-.5 0 2 1.4 3.6 3.2 4a4 4 0 0 1-1.8.1 4 4 0 0 0 3.8 2.8A8 8 0 0 1 2 18.2 11.4 11.4 0 0 0 8.2 20c7.4 0 11.5-6.2 11.5-11.5v-.5c.8-.6 1.5-1.3 2.3-2.1Z',
)
export const LinkedinIcon = createIcon('M4.5 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3 8.5h3V21H3V8.5Zm5 0h2.9v1.7c.4-.8 1.5-1.9 3.4-1.9 3.6 0 4.2 2.4 4.2 5.4V21h-3v-6.5c0-1.6 0-3.5-2.2-3.5s-2.4 1.7-2.4 3.4V21H8V8.5Z')
export const YoutubeIcon = createIcon(
  'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.5 2.5 0 0 0-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8ZM10 15V9l5.2 3L10 15Z',
)
export const GoogleIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8Z" />
    <path fill="#34A853" d="M12 23c3 0 5.5-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8A11 11 0 0 0 12 23Z" />
    <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7H2.2a11 11 0 0 0 0 10l3.6-2.8Z" />
    <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.2 7l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4Z" />
  </svg>
)
