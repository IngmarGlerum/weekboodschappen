/** Fouten met een vaste code en HTTP-status, zodat de web-app er netjes op kan reageren. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export class AuthError extends HttpError {
  constructor(status: 401 | 403, code: string, message: string) {
    super(status, code, message)
    this.name = 'AuthError'
  }
}

/** Picnic gaf een foutmelding terug. */
export class PicnicError extends HttpError {
  constructor(
    code: string,
    message: string,
    status = 502,
    /** De opgeslagen sleutel is verlopen of ingetrokken: opnieuw inloggen is nodig. */
    readonly authExpired = false,
  ) {
    super(status, code, message)
    this.name = 'PicnicError'
  }
}

export const notConnected = () =>
  new HttpError(409, 'picnic_not_connected', 'Picnic is nog niet gekoppeld. Log eerst in bij Picnic.')
