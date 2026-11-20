import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'

const base = {
  SUPABASE_URL: 'https://abc.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  PICNIC_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
}

describe('instellingen', () => {
  it('accepteert een gewoon Supabase-adres, ook met / of spatie erachter', () => {
    expect(loadConfig({ ...base }).supabaseUrl).toBe('https://abc.supabase.co')
    expect(loadConfig({ ...base, SUPABASE_URL: 'https://abc.supabase.co/ ' }).supabaseUrl).toBe('https://abc.supabase.co')
  })

  it.each(['https:https://abc.supabase.co', 'abc.supabase.co', 'http://abc.supabase.co', 'https://abc.supabase.co/rest/v1'])(
    'weigert meteen een fout adres: %s',
    (url) => {
      expect(() => loadConfig({ ...base, SUPABASE_URL: url })).toThrow(/SUPABASE_URL is geen geldig adres/)
    },
  )
})
