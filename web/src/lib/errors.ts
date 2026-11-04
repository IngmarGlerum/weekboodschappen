/** Vertaalt foutmeldingen van Supabase en onze database-functies naar begrijpelijk Nederlands. */
const MESSAGES: Array<[RegExp, string]> = [
  [/not_authenticated/, 'Je bent niet ingelogd.'],
  [/already_in_household/, 'Dit account hoort al bij deze planning.'],
  [/not_a_member/, 'Je bent geen lid (meer) van deze planning.'],
  [/email_not_verified/, 'Je e-mailadres is nog niet geverifieerd. Log in met de code uit de e-mail.'],
  [/invitation_not_found/, 'Deze uitnodiging bestaat niet (meer).'],
  [/invitation_wrong_email/, 'Deze uitnodiging is voor een ander e-mailadres. Log in met het adres waarop je bent uitgenodigd.'],
  [/invitation_used/, 'Deze uitnodiging is al gebruikt.'],
  [/invitation_expired/, 'Deze uitnodiging is verlopen. Vraag om een nieuwe.'],
  [/invalid login credentials/i, 'E-mailadres of wachtwoord klopt niet.'],
  [/email not confirmed/i, 'Je e-mailadres is nog niet bevestigd. Kies "Account maken" om een code te krijgen.'],
  [/signups not allowed for otp|user not found/i, 'Er is geen account met dit e-mailadres. Kies "Account maken".'],
  [/weak_password|password should be|password is too weak/i, 'Kies een langer of sterker wachtwoord (minstens 8 tekens).'],
  [/same_password|should be different from the old/i, 'Kies een ander wachtwoord dan je oude.'],
  [/reauthentication/i, 'Log opnieuw in met een code om je wachtwoord te wijzigen.'],
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
