/** Vertaalt foutmeldingen van Supabase en onze database-functies naar begrijpelijk Nederlands. */
const MESSAGES: Array<[RegExp, string]> = [
  [/not_authenticated/, 'Je bent niet ingelogd.'],
  [/already_in_household/, 'Dit account hoort al bij een huishouden.'],
  [/email_not_verified/, 'Je e-mailadres is nog niet geverifieerd. Log in met de code uit de e-mail.'],
  [/invitation_not_found/, 'Deze uitnodiging bestaat niet (meer).'],
  [/invitation_wrong_email/, 'Deze uitnodiging is voor een ander e-mailadres. Log in met het adres waarop je bent uitgenodigd.'],
  [/invitation_used/, 'Deze uitnodiging is al gebruikt.'],
  [/invitation_expired/, 'Deze uitnodiging is verlopen. Vraag om een nieuwe.'],
  [/token has expired or is invalid|otp_expired|invalid.*(token|code)/i, 'Die code klopt niet of is verlopen. Vraag een nieuwe aan.'],
  [/rate limit|too many requests|over_email_send_rate_limit/i, 'Te veel pogingen. Wacht even en probeer het opnieuw.'],
  [/failed to fetch|networkerror|network request failed|load failed/i, 'Geen verbinding. Probeer het opnieuw zodra je online bent.'],
]

export function describeError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error)
  for (const [pattern, text] of MESSAGES) {
    if (pattern.test(message)) return text
  }
  return message || 'Er ging iets mis.'
}
