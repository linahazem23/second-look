/** Shown wherever a name is public-facing — a username, when someone's set one, stands in for their real name. */
export function displayName(user: { fullName: string; username?: string | null }): string {
  return user.username || user.fullName;
}

/** For a private, first-person greeting (e.g. Home's "Hi, ...") — her real first name, never the pseudonym. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0];
}

// A whole persona to pick from, not "name + a number" — a blank username field
// asks her to invent something on the spot, so a ready-made pool in the app's
// own voice gives her something to just accept or tweak instead.
export const USERNAME_SUGGESTIONS = [
  'whoisthisgirl', 'girlbeserious', 'idontremember', 'oopsitsme', 'noturtype',
  'mentallysomewhere', 'currentlyaway', 'donttextbabe', 'probablylate', 'seenat2am',
  'shesconfused', 'cantbehave', 'girlwhattt', 'itsgivingnothing', 'respectfullyno2',
  'noquestionsplz', 'lowkeyiconic', 'highkeydelulu', 'sendhelpplz', 'notmyfault',
  'brbcrying', 'chronicallyonline', 'askmelater', 'girlmath', 'imsoreal',
  'notavailable', 'busybeingme', 'noideawhatimdoing', 'justvibing', 'itsjustme_'
] as const;

export function suggestUsername(): string {
  return USERNAME_SUGGESTIONS[Math.floor(Math.random() * USERNAME_SUGGESTIONS.length)];
}
