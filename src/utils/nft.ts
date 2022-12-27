import { createHash } from 'crypto'

export type TokenDataId = {
  creator: string
  collection: string
  name: string
}

export function hash(token_data_id: TokenDataId) {
  const string = `${token_data_id.creator}::${token_data_id.collection}::${token_data_id.name}`

  return createHash('sha256').update(string).digest('hex')
}
