import { AptosCacheResource } from '../types/aptos'

export class CachedContent {
  overdueTime: number

  value: AptosCacheResource | null

  constructor(value: AptosCacheResource | null, overdueTime = 0) {
    this.overdueTime = overdueTime
    this.value = value
  }

  getCacheData(): AptosCacheResource | null {
    if (this.value === null) {
      return null
    }
    if (this.overdueTime === 0) {
      return this.value
    }
    if (Date.parse(new Date().toString()) > this.overdueTime) {
      this.value = null
      return null
    }
    return this.value
  }
}
