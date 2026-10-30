import type { User } from '@/api/contracts'

export function UserAvatar({ user, size = 32 }: { user: Pick<User, 'displayName' | 'avatarUrl'>; size?: number }) {
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <span
      aria-hidden
      className="grid place-items-center rounded-full bg-accent font-bold text-accent-ink"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {user.displayName.slice(0, 1).toUpperCase()}
    </span>
  )
}
