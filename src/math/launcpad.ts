import { d } from '../utils/numbers'
import { FixedPricePool } from '../modules/launchpadModule'

export class LauncpadUtil {
  static minSettlePurchaseAmount(pool: FixedPricePool) {
    return d(pool.sale_total).mul(pool.initialize_price).mul(pool.least_raise_rate).toNumber()
  }

  static raiseTotalAmount(pool: FixedPricePool) {
    return d(pool.sale_total).mul(pool.initialize_price).toNumber()
  }
}
