import algosdk, { Address } from 'algosdk'
import { MultisigAccount, SigningAccount, TransactionSignerAccount } from './account'
import { AccountManager } from './account-manager'
import { AlgorandClientTransactionCreator } from './algorand-client-transaction-creator'
import { AlgorandClientTransactionSender } from './algorand-client-transaction-sender'
import { AppDeployer } from './app-deployer'
import { AppManager } from './app-manager'
import { AssetManager } from './asset-manager'
import { AlgoSdkClients, ClientManager } from './client-manager'
import { TransactionComposer } from './composer'
import { AlgoConfig } from './network-client'
import Account = algosdk.Account
import LogicSigAccount = algosdk.LogicSigAccount

/**
 * A high-level client for interacting with the Algorand blockchain.
 * Provides convenient access to common Algorand operations including account management,
 * application management, asset management, and transaction handling.
 *
 * @example Creating a client for TestNet
 * ```typescript
 * const client = AlgorandClient.testNet()
 * ```
 *
 * @example Creating a client from environment configuration
 * ```typescript
 * const client = AlgorandClient.fromEnvironment()
 * ```
 */
export class AlgorandClient {
  private _clientManager: ClientManager
  private _accountManager: AccountManager
  private _appManager: AppManager
  private _appDeployer: AppDeployer
  private _assetManager: AssetManager
  private _transactionSender: AlgorandClientTransactionSender
  private _transactionCreator: AlgorandClientTransactionCreator

  private _cachedSuggestedParams?: algosdk.SuggestedParams
  private _cachedSuggestedParamsExpiry?: Date
  private _cachedSuggestedParamsTimeout: number = 3_000 // three seconds

  private _defaultValidityWindow: bigint | undefined = undefined

  private constructor(config: AlgoConfig | AlgoSdkClients) {
    this._clientManager = new ClientManager(config, this)
    this._accountManager = new AccountManager(this._clientManager)
    this._appManager = new AppManager(this._clientManager.algod)
    this._assetManager = new AssetManager(this._clientManager.algod, () => this.newGroup())
    this._transactionSender = new AlgorandClientTransactionSender(() => this.newGroup(), this._assetManager, this._appManager)
    this._transactionCreator = new AlgorandClientTransactionCreator(() => this.newGroup())
    this._appDeployer = new AppDeployer(this._appManager, this._transactionSender, this._clientManager.indexerIfPresent)
  }

  /**
   * Sets the default validity window for transactions in this client instance.
   * The validity window determines how long transactions remain valid after they are created.
   *
   * @param validityWindow - The validity window in number of rounds
   * @returns The current AlgorandClient instance for chaining
   *
   * @example Setting a 10-round validity window
   * ```typescript
   * client.setDefaultValidityWindow(10)
   * ```
   */
  public setDefaultValidityWindow(validityWindow: number | bigint) {
    this._defaultValidityWindow = BigInt(validityWindow)
    return this
  }

  /**
   * Sets the default transaction signer for this client instance.
   *
   * @param signer - The transaction signer to use as default
   * @returns The current AlgorandClient instance for chaining
   *
   * @example Setting a default signer
   * ```typescript
   * const account = algosdk.generateAccount()
   * client.setDefaultSigner(account)
   * ```
   */
  public setDefaultSigner(signer: algosdk.TransactionSigner | TransactionSignerAccount): AlgorandClient {
    this._accountManager.setDefaultSigner(signer)
    return this
  }

  /**
   * Sets a signer from an account object. Supports various account types including
   * basic accounts, multisig accounts, and logic signature accounts.
   *
   * @param account - The account to use for signing
   * @returns The current AlgorandClient instance for chaining
   *
   * @example Setting a signer from a basic account
   * ```typescript
   * const account = algosdk.generateAccount()
   * client.setSignerFromAccount(account)
   * ```
   */
  public setSignerFromAccount(
    account: TransactionSignerAccount | TransactionSignerAccount | Account | LogicSigAccount | SigningAccount | MultisigAccount,
  ) {
    this._accountManager.setSignerFromAccount(account)
    return this
  }

  /**
   * Sets a specific signer for a given sender address.
   *
   * @param sender - The address of the sender
   * @param signer - The transaction signer to use
   * @returns The current AlgorandClient instance for chaining
   *
   * @example Setting a signer for a specific address
   * ```typescript
   * const account = algosdk.generateAccount()
   * client.setSigner(account.addr, account.signer)
   * ```
   */
  public setSigner(sender: string | Address, signer: algosdk.TransactionSigner) {
    this._accountManager.setSigner(sender, signer)
    return this
  }

  /**
   * Sets suggested parameters in the cache with an optional expiry time.
   *
   * @param suggestedParams - The suggested parameters to cache
   * @param until - Optional expiry time for the cached parameters
   * @returns The current AlgorandClient instance for chaining
   *
   * @example Caching suggested parameters
   * ```typescript
   * const params = await client.getSuggestedParams()
   * client.setSuggestedParamsCache(params)
   * ```
   */
  public setSuggestedParamsCache(suggestedParams: algosdk.SuggestedParams, until?: Date) {
    this._cachedSuggestedParams = suggestedParams
    this._cachedSuggestedParamsExpiry = until ?? new Date(+new Date() + this._cachedSuggestedParamsTimeout)
    return this
  }

  /**
   * Sets the timeout duration for the suggested parameters cache.
   *
   * @param timeout - The timeout duration in milliseconds
   * @returns The current AlgorandClient instance for chaining
   *
   * @example Setting a 5-second cache timeout
   * ```typescript
   * client.setSuggestedParamsCacheTimeout(5000)
   * ```
   */
  public setSuggestedParamsCacheTimeout(timeout: number) {
    this._cachedSuggestedParamsTimeout = timeout
    return this
  }

  /**
   * Retrieves the current suggested parameters, either from cache if valid or from the network.
   *
   * @returns A promise that resolves to the current suggested parameters
   *
   * @example Getting suggested parameters
   * ```typescript
   * const params = await client.getSuggestedParams()
   * ```
   */
  public async getSuggestedParams(): Promise<algosdk.SuggestedParams> {
    if (this._cachedSuggestedParams && (!this._cachedSuggestedParamsExpiry || this._cachedSuggestedParamsExpiry > new Date())) {
      return {
        ...this._cachedSuggestedParams,
      }
    }

    this._cachedSuggestedParams = await this._clientManager.algod.getTransactionParams().do()
    this._cachedSuggestedParamsExpiry = new Date(new Date().getTime() + this._cachedSuggestedParamsTimeout)

    return {
      ...this._cachedSuggestedParams,
    }
  }

  public get client() {
    return this._clientManager
  }

  public get account() {
    return this._accountManager
  }

  public get asset() {
    return this._assetManager
  }

  public get app() {
    return this._appManager
  }

  public get appDeployer() {
    return this._appDeployer
  }

  public newGroup() {
    return new TransactionComposer({
      algod: this.client.algod,
      getSigner: (addr: string | Address) => this.account.getSigner(addr),
      getSuggestedParams: () => this.getSuggestedParams(),
      defaultValidityWindow: this._defaultValidityWindow,
      appManager: this._appManager,
    })
  }

  public get send() {
    return this._transactionSender
  }

  public get createTransaction() {
    return this._transactionCreator
  }

  /**
   * Creates a new instance of AlgorandClient configured for LocalNet.
   *
   * @returns A new AlgorandClient instance configured for LocalNet
   *
   * @example Creating a LocalNet client
   * ```typescript
   * const localNetClient = AlgorandClient.defaultLocalNet()
   * ```
   */
  public static defaultLocalNet() {
    return new AlgorandClient({
      algodConfig: ClientManager.getDefaultLocalNetConfig('algod'),
      indexerConfig: ClientManager.getDefaultLocalNetConfig('indexer'),
      kmdConfig: ClientManager.getDefaultLocalNetConfig('kmd'),
    })
  }

  /**
   * Creates a new instance of AlgorandClient configured for TestNet.
   *
   * @returns A new AlgorandClient instance configured for TestNet
   *
   * @example Creating a TestNet client
   * ```typescript
   * const testNetClient = AlgorandClient.testNet()
   * ```
   */
  public static testNet() {
    return new AlgorandClient({
      algodConfig: ClientManager.getAlgoNodeConfig('testnet', 'algod'),
      indexerConfig: ClientManager.getAlgoNodeConfig('testnet', 'indexer'),
      kmdConfig: undefined,
    })
  }

  /**
   * Creates a new instance of AlgorandClient configured for MainNet.
   *
   * @returns A new AlgorandClient instance configured for MainNet
   *
   * @example Creating a MainNet client
   * ```typescript
   * const mainNetClient = AlgorandClient.mainNet()
   * ```
   */
  public static mainNet() {
    return new AlgorandClient({
      algodConfig: ClientManager.getAlgoNodeConfig('mainnet', 'algod'),
      indexerConfig: ClientManager.getAlgoNodeConfig('mainnet', 'indexer'),
      kmdConfig: undefined,
    })
  }

  /**
   * Creates a new instance of AlgorandClient from existing Algorand SDK clients.
   *
   * @param clients - The Algorand SDK clients to use
   * @returns A new AlgorandClient instance using the provided clients
   *
   * @example Creating a client from existing SDK clients
   * ```typescript
   * const algodClient = new algosdk.Algodv2(...)
   * const indexerClient = new algosdk.Indexer(...)
   * const client = AlgorandClient.fromClients({ algod: algodClient, indexer: indexerClient })
   * ```
   */
  public static fromClients(clients: AlgoSdkClients) {
    return new AlgorandClient(clients)
  }

  /**
   * Creates a new instance of AlgorandClient using configuration from environment variables.
   * Falls back to LocalNet configuration if environment variables are not set.
   *
   * @returns A new AlgorandClient instance configured from environment
   *
   * @example Creating a client from environment
   * ```typescript
   * const client = AlgorandClient.fromEnvironment()
   * ```
   */
  public static fromEnvironment() {
    return new AlgorandClient(ClientManager.getConfigFromEnvironmentOrLocalNet())
  }

  /**
   * Creates a new instance of AlgorandClient from a configuration object.
   *
   * @param config - The configuration object
   * @returns A new AlgorandClient instance using the provided configuration
   *
   * @example Creating a client from custom configuration
   * ```typescript
   * const config = {
   *   algodConfig: { server: 'https://testnet-api.algonode.cloud', port: '', token: '' },
   *   indexerConfig: { server: 'https://testnet-idx.algonode.cloud', port: '', token: '' }
   * }
   * const client = AlgorandClient.fromConfig(config)
   * ```
   */
  public static fromConfig(config: AlgoConfig) {
    return new AlgorandClient(config)
  }
}
