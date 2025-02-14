import algosdk, { SuggestedParams } from 'algosdk'
import { AlgoHttpClientWithRetry } from './algo-http-client-with-retry'
import { AlgorandClientInterface } from './algorand-client-interface'
import { AppClient, AppClientParams, ResolveAppClientByCreatorAndName } from './app-client'
import { AppFactory, AppFactoryParams } from './app-factory'
import { TestNetDispenserApiClient, TestNetDispenserApiClientParams } from './dispenser-client'
import { Expand } from './expand'
import { AlgoClientConfig, AlgoConfig, NetworkDetails, genesisIdIsLocalNet } from './network-client'
import Kmd = algosdk.Kmd
import Indexer = algosdk.Indexer
import Algodv2 = algosdk.Algodv2

/**
 * A collection of Algorand SDK client instances that interact with the official Algorand APIs.
 * Provides access to Algod, Indexer, and KMD clients.
 */
export interface AlgoSdkClients {
  /**
   * Algod client, see https://developer.algorand.org/docs/rest-apis/algod/
   */
  algod: algosdk.Algodv2
  /**
   * Optional indexer client, see https://developer.algorand.org/docs/rest-apis/indexer/
   */
  indexer?: algosdk.Indexer
  /**
   * Optional KMD client, see https://developer.algorand.org/docs/rest-apis/kmd/
   */
  kmd?: algosdk.Kmd
}

/**
 * Parameters used to create an app factory from `ClientManager`, excluding the Algorand client.
 */
export type ClientAppFactoryParams = Expand<Omit<AppFactoryParams, 'algorand'>>

/**
 * Parameters used to resolve an app client by creator address and name from `ClientManager`, excluding the Algorand client.
 */
export type ClientResolveAppClientByCreatorAndNameParams = Expand<Omit<ResolveAppClientByCreatorAndName, 'algorand'>>

/**
 * Parameters used to create an app client by ID from `ClientManager`, excluding the Algorand client.
 */
export type ClientAppClientParams = Expand<Omit<AppClientParams, 'algorand'>>

/**
 * Parameters used to create an app client by network from `ClientManager`, excluding the Algorand client and app ID.
 */
export type ClientAppClientByNetworkParams = Expand<Omit<AppClientParams, 'algorand' | 'appId'>>

/**
 * Parameters used to resolve a typed app client by creator address and name from `ClientManager`, excluding the Algorand client and app specification.
 */
export type ClientTypedAppClientByCreatorAndNameParams = Expand<Omit<ResolveAppClientByCreatorAndName, 'algorand' | 'appSpec'>>

/**
 * Parameters used to create a typed app client by ID from `ClientManager`, excluding the Algorand client and app specification.
 */
export type ClientTypedAppClientParams = Expand<Omit<AppClientParams, 'algorand' | 'appSpec'>>

/**
 * Parameters used to create a typed app client by network from `ClientManager`, excluding the Algorand client, app specification, and app ID.
 */
export type ClientTypedAppClientByNetworkParams = Expand<Omit<AppClientParams, 'algorand' | 'appSpec' | 'appId'>>

/**
 * Parameters used to create a typed app factory from `ClientManager`, excluding the Algorand client and app specification.
 */
export type ClientTypedAppFactoryParams = Expand<Omit<AppFactoryParams, 'algorand' | 'appSpec'>>

/**
 * Manages access to various Algorand API clients and provides helper methods for creating app clients and factories.
 * This class serves as a centralized client manager for interacting with the Algorand blockchain.
 */
export class ClientManager {
  private _algod: algosdk.Algodv2
  private _indexer?: algosdk.Indexer
  private _kmd?: algosdk.Kmd
  private _algorand?: AlgorandClientInterface

  /**
   * Initializes a new instance of `ClientManager`.
   *
   * @param clientsOrConfig - The Algorand SDK clients or configuration to use.
   * @param algorandClient - (Optional) An instance of `AlgorandClientInterface`.
   *
   * @example Algod client only
   * ```typescript
   * const clientManager = new ClientManager({ algod: algodClient })
   * ```
   * @example All clients
   * ```typescript
   * const clientManager = new ClientManager({ algod: algodClient, indexer: indexerClient, kmd: kmdClient })
   * ```
   * @example Algod config only
   * ```typescript
   * const clientManager = new ClientManager({ algodConfig })
   * ```
   * @example All client configs
   * ```typescript
   * const clientManager = new ClientManager({ algodConfig, indexerConfig, kmdConfig })
   * ```
   */
  constructor(clientsOrConfig: AlgoConfig | AlgoSdkClients, algorandClient?: AlgorandClientInterface) {
    const _clients =
      'algod' in clientsOrConfig
        ? clientsOrConfig
        : {
            algod: ClientManager.getAlgodClient(clientsOrConfig.algodConfig),
            indexer: clientsOrConfig.indexerConfig ? ClientManager.getIndexerClient(clientsOrConfig.indexerConfig) : undefined,
            kmd: clientsOrConfig.kmdConfig ? ClientManager.getKmdClient(clientsOrConfig.kmdConfig) : undefined,
          }
    this._algod = _clients.algod
    this._indexer = _clients.indexer
    this._kmd = _clients.kmd
    this._algorand = algorandClient
  }

  /**
   * Retrieves the algod client instance associated with this `ClientManager`.
   *
   * @example
   * ```typescript
   * const algodClient = clientManager.algod
   * const params = await algodClient.getTransactionParams().do()
   * ```
   * @returns The algod client instance.
   */
  public get algod(): algosdk.Algodv2 {
    return this._algod
  }

  /**
   * Gets the associated indexer client instance.
   * 
   * @throws Error if no Indexer client is configured
   * @returns The indexer client instance
   * 
   * @example
   * ```typescript
   * const indexerClient = clientManager.indexer
   * const account = await indexerClient.lookupAccountByID(address).do()
   * ```
   */
  public get indexer(): algosdk.Indexer {
    if (!this._indexer) throw new Error('Attempt to use Indexer client in AlgoKit instance with no Indexer configured')
    return this._indexer
  }

  /**
   * Gets the indexer client instance if one is configured, otherwise returns undefined.
   * 
   * @returns The indexer client instance if configured, otherwise undefined
   * 
   * @example
   * ```typescript
   * const indexer = clientManager.indexerIfPresent
   * if (indexer) {
   *   const account = await indexer.lookupAccountByID(address).do()
   * }
   * ```
   */
  public get indexerIfPresent(): algosdk.Indexer | undefined {
    return this._indexer
  }

  /**
   * Gets the associated KMD client instance.
   * 
   * @throws Error if no KMD client is configured
   * @returns The KMD client instance
   * 
   * @example
   * ```typescript
   * const kmdClient = clientManager.kmd
   * const wallets = await kmdClient.listWallets()
   * ```
   */
  public get kmd(): algosdk.Kmd {
    if (!this._kmd) throw new Error('Attempt to use Kmd client in AlgoKit instance with no Kmd configured')
    return this._kmd
  }

  private _getNetworkPromise: Promise<SuggestedParams> | undefined

  /**
   * Gets details about the current network, including whether it's MainNet, TestNet, or LocalNet.
   * 
   * @returns Promise that resolves to the network details
   * 
   * @example
   * ```typescript
   * const network = await clientManager.network()
   * if (network.isTestNet) {
   *   console.log('Connected to TestNet')
   * }
   * ```
   */
  public async network(): Promise<NetworkDetails> {
    if (!this._getNetworkPromise) {
      this._getNetworkPromise = this._algod.getTransactionParams().do()
    }

    const params = await this._getNetworkPromise
    return {
      isTestNet: ['testnet-v1.0', 'testnet-v1', 'testnet'].includes(params.genesisID ?? 'unknown'),
      isMainNet: ['mainnet-v1.0', 'mainnet-v1', 'mainnet'].includes(params.genesisID ?? 'unknown'),
      isLocalNet: ClientManager.genesisIdIsLocalNet(params.genesisID ?? 'unknown'),
      genesisId: params.genesisID ?? 'unknown',
      genesisHash: params.genesisHash ? Buffer.from(params.genesisHash).toString('base64') : 'unknown',
    }
  }

  /**
   * Determines if a genesis ID corresponds to a LocalNet network.
   * 
   * @param genesisId - The genesis ID to check
   * @returns True if the genesis ID corresponds to LocalNet, false otherwise
   * 
   * @example
   * ```typescript
   * const isLocal = ClientManager.genesisIdIsLocalNet('sandnet-v1')
   * ```
   */
  public static genesisIdIsLocalNet(genesisId: string): boolean {
    return genesisIdIsLocalNet(genesisId)
  }

  /**
   * Checks if the current network is LocalNet.
   * 
   * @returns Promise that resolves to true if connected to LocalNet, false otherwise
   * 
   * @example
   * ```typescript
   * if (await clientManager.isLocalNet()) {
   *   console.log('Connected to LocalNet')
   * }
   * ```
   */
  public async isLocalNet(): Promise<boolean> {
    return (await this.network()).isLocalNet
  }

  /**
   * Checks if the current network is TestNet.
   * 
   * @returns Promise that resolves to true if connected to TestNet, false otherwise
   * 
   * @example
   * ```typescript
   * if (await clientManager.isTestNet()) {
   *   console.log('Connected to TestNet')
   * }
   * ```
   */
  public async isTestNet(): Promise<boolean> {
    return (await this.network()).isTestNet
  }

  /**
   * Checks if the current network is MainNet.
   * 
   * @returns Promise that resolves to true if connected to MainNet, false otherwise
   * 
   * @example
   * ```typescript
   * if (await clientManager.isMainNet()) {
   *   console.log('Connected to MainNet')
   * }
   * ```
   */
  public async isMainNet(): Promise<boolean> {
    return (await this.network()).isMainNet
  }

  /**
   * Creates a new instance of `TestNetDispenserApiClient` with the provided parameters.
   *
   * @param params - Parameters for configuring the TestNet dispenser client.
   * @returns An instance of `TestNetDispenserApiClient`.
   */
  public getTestNetDispenser(params: TestNetDispenserApiClientParams): TestNetDispenserApiClient {
    return new TestNetDispenserApiClient(params)
  }

  /**
   * Creates a new instance of `TestNetDispenserApiClient` using environment variables.
   *
   * @param params - (Optional) Parameters excluding the `authToken`.
   * @returns An instance of `TestNetDispenserApiClient`.
   */
  public getTestNetDispenserFromEnvironment(params?: Omit<TestNetDispenserApiClientParams, 'authToken'>): TestNetDispenserApiClient {
    return new TestNetDispenserApiClient(params ? { ...params, authToken: '' } : undefined)
  }

  /**
   * Gets an app factory for deploying and managing Algorand applications.
   * 
   * @param params - Parameters for configuring the app factory
   * @returns An instance of AppFactory
   * @throws Error if no Algorand client is configured
   * 
   * @example
   * ```typescript
   * const factory = clientManager.getAppFactory({
   *   sender: senderAccount,
   *   deploymentConfig: { version: 1 }
   * })
   * ```
   */
  public getAppFactory(params: ClientAppFactoryParams): AppFactory {
    if (!this._algorand) {
      throw new Error('Attempt to get app factory from a ClientManager without an Algorand client')
    }

    return new AppFactory({ ...params, algorand: this._algorand })
  }

  /**
   * Gets an app client by looking up the application using its creator address and name.
   * 
   * @param params - Parameters for resolving the app client
   * @returns An instance of AppClient
   * @throws Error if no Algorand client is configured
   * 
   * @example
   * ```typescript
   * const client = clientManager.getAppClientByCreatorAndName({
   *   name: 'MyApp',
   *   creator: creatorAddress,
   *   sender: senderAccount
   * })
   * ```
   */
  public getAppClientByCreatorAndName(params: ClientResolveAppClientByCreatorAndNameParams): AppClient {
    if (!this._algorand) {
      throw new Error('Attempt to get app client from a ClientManager without an Algorand client')
    }

    return AppClient.fromCreatorAndName({
      ...params,
      algorand: this._algorand,
    })
  }

  /**
   * Retrieves an `AppClient` instance by application ID.
   *
   * @param params - Parameters for configuring the AppClient.
   * @returns An instance of `AppClient`.
   * @throws Error if no Algorand client is associated with the `ClientManager`.
   */
  public getAppClientById(params: ClientAppClientParams): AppClient {
    if (!this._algorand) {
      throw new Error('Attempt to get app client from a ClientManager without an Algorand client')
    }
    return new AppClient({ ...params, algorand: this._algorand })
  }

  /**
   * Asynchronously retrieves an `AppClient` instance by network.
   *
   * @param params - Parameters for resolving the AppClient by network.
   * @returns A promise that resolves to an instance of `AppClient`.
   * @throws Error if no Algorand client is associated with the `ClientManager`.
   */
  public async getAppClientByNetwork(params: ClientAppClientByNetworkParams): Promise<AppClient> {
    if (!this._algorand) {
      throw new Error('Attempt to get app client from a ClientManager without an Algorand client')
    }
    return AppClient.fromNetwork({ ...params, algorand: this._algorand })
  }

  /**
   * Gets a typed app client by looking up the application using its creator address and name.
   * 
   * @param typedClient - The typed client class
   * @param params - Parameters for resolving the app client
   * @returns Promise that resolves to an instance of the typed client
   * @throws Error if no Algorand client is configured
   * 
   * @example
   * ```typescript
   * const client = await clientManager.getTypedAppClientByCreatorAndName(
   *   MyAppClient,
   *   {
   *     name: 'MyApp',
   *     creator: creatorAddress,
   *     sender: senderAccount
   *   }
   * )
   * ```
   */
  public async getTypedAppClientByCreatorAndName<TClient extends TypedAppClient<InstanceType<TClient>>>(
    typedClient: TClient,
    params: ClientTypedAppClientByCreatorAndNameParams,
  ): Promise<TClient> {
    if (!this._algorand) {
      throw new Error('Attempt to get app client from a ClientManager without an Algorand client')
    }

    return typedClient.fromCreatorAndName({ ...params, algorand: this._algorand })
  }

  /**
   * Gets a typed app client for an existing application by its ID.
   * 
   * @param typedClient - The typed client class
   * @param params - Parameters for configuring the app client
   * @returns An instance of the typed client
   * @throws Error if no Algorand client is configured
   * 
   * @example
   * ```typescript
   * const client = clientManager.getTypedAppClientById(
   *   MyAppClient,
   *   {
   *     appId: 123,
   *     sender: senderAccount
   *   }
   * )
   * ```
   */
  public getTypedAppClientById<TClient extends TypedAppClient<InstanceType<TClient>>>(
    typedClient: TClient,
    params: ClientTypedAppClientParams,
  ): TClient {
    if (!this._algorand) {
      throw new Error('Attempt to get app client from a ClientManager without an Algorand client')
    }

    return new typedClient({ ...params, algorand: this._algorand })
  }

  public getTypedAppClientByNetwork<TClient extends TypedAppClient<InstanceType<TClient>>>(
    typedClient: TClient,
    params?: ClientTypedAppClientByNetworkParams,
  ): Promise<TClient> {
    if (!this._algorand) {
      throw new Error('Attempt to get app client from a ClientManager without an Algorand client')
    }

    return typedClient.fromNetwork({ ...params, algorand: this._algorand })
  }

  /**
   * Gets a typed app factory for deploying and managing typed Algorand applications.
   * 
   * @param typedFactory - The typed factory class
   * @param params - Optional parameters for configuring the app factory
   * @returns An instance of the typed factory
   * @throws Error if no Algorand client is configured
   * 
   * @example
   * ```typescript
   * const factory = clientManager.getTypedAppFactory(
   *   MyAppFactory,
   *   {
   *     sender: senderAccount,
   *     deploymentConfig: { version: 1 }
   *   }
   * )
   * ```
   */
  public getTypedAppFactory<TClient>(typedFactory: TypedAppFactory<TClient>, params?: ClientTypedAppFactoryParams): TClient {
    if (!this._algorand) {
      throw new Error('Attempt to get app factory from a ClientManager without an Algorand client')
    }

    return new typedFactory({ ...params, algorand: this._algorand })
  }

  public static getConfigFromEnvironmentOrLocalNet(): AlgoConfig {
    if (!process || !process.env) {
      throw new Error('Attempt to get default client configuration from a non Node.js context; supply the config instead')
    }
    const [algodConfig, indexerConfig, kmdConfig] = process.env.ALGOD_SERVER
      ? [
          ClientManager.getAlgodConfigFromEnvironment(),
          process.env.INDEXER_SERVER ? ClientManager.getIndexerConfigFromEnvironment() : undefined,
          !process.env.ALGOD_SERVER.includes('mainnet') && !process.env.ALGOD_SERVER.includes('testnet')
            ? { ...ClientManager.getAlgodConfigFromEnvironment(), port: process?.env?.KMD_PORT ?? '4002' }
            : undefined,
        ]
      : [
          ClientManager.getDefaultLocalNetConfig('algod'),
          ClientManager.getDefaultLocalNetConfig('indexer'),
          ClientManager.getDefaultLocalNetConfig('kmd'),
        ]

    return {
      algodConfig,
      indexerConfig,
      kmdConfig,
    }
  }

  public static getAlgodConfigFromEnvironment(): AlgoClientConfig {
    if (!process || !process.env) {
      throw new Error('Attempt to get default algod configuration from a non Node.js context; supply the config instead')
    }

    if (!process.env.ALGOD_SERVER) {
      throw new Error('Attempt to get default algod configuration without specifying ALGOD_SERVER in the environment variables')
    }

    return {
      server: process.env.ALGOD_SERVER,
      port: process.env.ALGOD_PORT,
      token: process.env.ALGOD_TOKEN,
    }
  }

  public static getIndexerConfigFromEnvironment(): AlgoClientConfig {
    if (!process || !process.env) {
      throw new Error('Attempt to get default indexer configuration from a non Node.js context; supply the config instead')
    }

    if (!process.env.INDEXER_SERVER) {
      throw new Error('Attempt to get default indexer configuration without specifying INDEXER_SERVER in the environment variables')
    }

    return {
      server: process.env.INDEXER_SERVER,
      port: process.env.INDEXER_PORT,
      token: process.env.INDEXER_TOKEN,
    }
  }

  /**
   * Constructs the Algonode configuration based on the specified network and client type.
   *
   * @param network - The target network ('testnet' or 'mainnet').
   * @param config - The client type ('algod' or 'indexer').
   * @returns The Algonode client configuration.
   */
  public static getAlgoNodeConfig(network: 'testnet' | 'mainnet', config: 'algod' | 'indexer'): AlgoClientConfig {
    return {
      server: `https://${network}-${config === 'algod' ? 'api' : 'idx'}.algonode.cloud/`,
      port: 443,
    }
  }

  /**
   * Retrieves the default LocalNet configuration based on the specified client type or custom port.
   *
   * @param configOrPort - The client type ('algod', 'indexer', 'kmd') or a custom port number.
   * @returns The LocalNet client configuration.
   */
  public static getDefaultLocalNetConfig(configOrPort: 'algod' | 'indexer' | 'kmd' | number): AlgoClientConfig {
    return {
      server: `http://localhost`,
      port: configOrPort === 'algod' ? 4001 : configOrPort === 'indexer' ? 8980 : configOrPort === 'kmd' ? 4002 : configOrPort,
      token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }
  }

  /**
   * Creates a new Algod client based on the provided configuration.
   *
   * @param config - The Algod client configuration.
   * @returns An instance of `algosdk.Algodv2`.
   */
  public static getAlgodClient(config: AlgoClientConfig): Algodv2 {
    const { token, server, port } = config
    const tokenHeader = typeof token === 'string' ? { 'X-Algo-API-Token': token } : (token ?? {})
    const httpClientWithRetry = new AlgoHttpClientWithRetry(tokenHeader, server, port)
    return new algosdk.Algodv2(httpClientWithRetry, server)
  }

  /**
   * Creates a new Algod client using environment variables.
   *
   * @returns An instance of `algosdk.Algodv2`.
   */
  public static getAlgodClientFromEnvironment(): Algodv2 {
    return ClientManager.getAlgodClient(ClientManager.getAlgodConfigFromEnvironment())
  }

  /**
   * Creates a new Indexer client based on the provided configuration.
   *
   * @param config - The Indexer client configuration.
   * @returns An instance of `algosdk.Indexer`.
   */
  public static getIndexerClient(config: AlgoClientConfig): Indexer {
    const { token, server, port } = config
    const tokenHeader = typeof token === 'string' ? { 'X-Indexer-API-Token': token } : (token ?? {})
    const httpClientWithRetry = new AlgoHttpClientWithRetry(tokenHeader, server, port)
    return new Indexer(httpClientWithRetry)
  }

  /**
   * Creates a new Indexer client using environment variables.
   *
   * @example
   *  ```typescript
   *  // Uses process.env.INDEXER_SERVER, process.env.INDEXER_PORT and process.env.INDEXER_TOKEN
   *  const indexer = ClientManager.getIndexerClientFromEnvironment()
   *  await indexer.makeHealthCheck().do()
   *  ```
   * @returns An instance of `algosdk.Indexer`.
   */
  public static getIndexerClientFromEnvironment(): Indexer {
    return ClientManager.getIndexerClient(ClientManager.getIndexerConfigFromEnvironment())
  }

  /**
   * Creates a new KMD client based on the provided configuration.
   *
   * @param config - The KMD client configuration.
   * @returns An instance of `algosdk.Kmd`.
   *
   * @example Custom (e.g., default LocalNet)
   * ```typescript
   *  const kmd = ClientManager.getKmdClient({server: 'http://localhost', port: '4002', token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'})
   * ```
   */
  public static getKmdClient(config: AlgoClientConfig): Kmd {
    const { token, server, port } = config
    return new Kmd(token as string, server, port)
  }

  /**
   * Creates a new KMD client using environment variables.
   *
   * @example
   *  ```typescript
   *  // Uses process.env.ALGOD_SERVER, process.env.KMD_PORT (or defaults to port 4002) and process.env.ALGOD_TOKEN
   *  const kmd = ClientManager.getKmdClientFromEnvironment()
   *  ```
   * @returns An instance of `algosdk.Kmd`.
   */
  public static getKmdClientFromEnvironment(): Kmd {
    // We can only use Kmd on the LocalNet otherwise it's not exposed so this makes some assumptions
    // (e.g., same token and server as algod and port 4002 by default)
    return ClientManager.getKmdClient({ ...ClientManager.getAlgodConfigFromEnvironment(), port: process?.env?.KMD_PORT ?? '4002' })
  }
}

/**
 * Interface defining the structure of a typed client that can interact with an Algorand application.
 * Provides methods for creating new instances and resolving existing applications.
 */
export interface TypedAppClient<TClient> {
  /**
   * Creates a new instance of the typed AppClient.
   *
   * @param params - Parameters excluding the `appSpec`.
   */
  new (params: Omit<AppClientParams, 'appSpec'>): TClient

  /**
   * Asynchronously creates a typed AppClient from network parameters.
   *
   * @param params - Parameters excluding `appId` and `appSpec`.
   * @returns A promise that resolves to an instance of the typed AppClient.
   */
  fromNetwork(params: Omit<AppClientParams, 'appId' | 'appSpec'>): Promise<TClient>

  /**
   * Asynchronously creates a typed AppClient from creator address and name.
   *
   * @param params - Parameters excluding `appSpec`.
   * @returns A promise that resolves to an instance of the typed AppClient.
   */
  fromCreatorAndName(params: Omit<ResolveAppClientByCreatorAndName, 'appSpec'>): Promise<TClient>
}

/**
 * Interface defining the structure of a typed factory that can create and deploy Algorand applications.
 * Provides methods for creating new instances with application specifications.
 */
export interface TypedAppFactory<TClient> {
  /**
   * Creates a new instance of the typed AppFactory.
   *
   * @param params - Parameters excluding the `appSpec`.
   */
  new (params: Omit<AppFactoryParams, 'appSpec'>): TClient
}
