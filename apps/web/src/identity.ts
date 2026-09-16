/** Shown wherever a name is public-facing — a username, when someone's set one, stands in for their real name. */
export function displayName(user: { fullName: string; username?: string | null }): string {
  return user.username || user.fullName;
}
