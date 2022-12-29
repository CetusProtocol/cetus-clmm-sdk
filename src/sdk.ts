import { AptosClient, TokenClient } from 'aptos'
import { SwapModule } from './modules/swapModule'
import { PositionModule } from './modules/positionModule'
import { GlobalConfig, ResourcesModule } from './modules/resourcesModule'
import { AptosResourceType } from './types/aptos'
import { PoolModule } from './modules/poolModule'
import { RewarderModule } from './modules/rewarderModule'
import { TokenModule } from './modules/tokenModule'
import { RouterModule } from './modules/routerModule'
import { FetcherModule } from './modules/fetcherModule'
import { LaunchpadModule } from './modules/launchpadModule'

// not sure yet
export type SdkOptions = {
  rpcUrl: string
  networkOptions: {
    nativeToken: AptosResourceType
    launchpad: {
      cetusLaunchpad: AptosResourceType
      crowdCoin: AptosResourceType
    }
    modules: {
      LiquidswapDeployer: AptosResourceType
      ClmmIntegrate: AptosResourceType
      FetcherDeployer: AptosResourceType
      TokenDeployer: AptosResourceType
      IntegerMate: AptosResourceType
    } & Record<string, AptosResourceType>
  }
}
export class SDK {
  protected _client: AptosClient

  protected _tokenClient: TokenClient

  protected _swap: SwapModule

  protected _position: PositionModule

  protected _pool: PoolModule

  protected _resources: ResourcesModule

  protected _rewarder: RewarderModule

  protected _router: RouterModule

  protected _token: TokenModule

  protected _fetcher: FetcherModule

  protected _launchpad: LaunchpadModule

  protected _sdkOptions: SdkOptions

  private globalConfig: GlobalConfig = {
    protocol_fee_rate: '',
    is_pause: false,
  }

  constructor(options: SdkOptions) {
    this._sdkOptions = options
    this._client = new AptosClient(options.rpcUrl)
    this._tokenClient = new TokenClient(this._client)
    this._swap = new SwapModule(this)
    this._position = new PositionModule(this)
    this._resources = new ResourcesModule(this)
    this._pool = new PoolModule(this)
    this._rewarder = new RewarderModule(this)
    this._router = new RouterModule(this)
    this._token = new TokenModule(this)
    this._fetcher = new FetcherModule(this)
    this._launchpad = new LaunchpadModule(this)

    this.globalConfig.protocol_fee_rate = ''
  }

  async getGlobalConfig(forceRefresh = false): Promise<GlobalConfig> {
    if (this.globalConfig.protocol_fee_rate.length === 0 || forceRefresh) {
      this.globalConfig = await this._resources.getGlobalConfig(this._sdkOptions.networkOptions.modules.LiquidswapDeployer)
    }
    return this.globalConfig
  }

  get client() {
    return this._client
  }

  get tokenClient() {
    return this._tokenClient
  }

  get Swap() {
    return this._swap
  }

  get Position() {
    return this._position
  }

  get Pool() {
    return this._pool
  }

  get Resources() {
    return this._resources
  }

  get Rewarder() {
    return this._rewarder
  }

  get Token() {
    return this._token
  }

  get Router() {
    return this._router
  }

  get Fetcher() {
    return this._fetcher
  }

  get Launchpad() {
    return this._launchpad
  }

  get sdkOptions() {
    return this._sdkOptions
  }
}
