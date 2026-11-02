/** Laat acties per sleutel (het huishouden) na elkaar lopen, zodat twee telefoons elkaar niet storen. */
export class KeyedMutex {
  private tails = new Map<string, Promise<unknown>>()

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(task)
    this.tails.set(key, next)
    try {
      return await next
    } finally {
      if (this.tails.get(key) === next) this.tails.delete(key)
    }
  }
}
