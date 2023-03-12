import algosdk, { Account, Algodv2, Kmd } from 'algosdk'
import { getAccountFromMnemonic, getDispenserAccount } from './account'
import { AlgoAmount } from './algo-amount'
import { AlgoKitConfig } from './config'
import { getAlgoKmdClient } from './network-client'
import { transferAlgos } from './transfer'

/** Returns true if the algod client is pointing to a LocalNet Algorand network */
export async function isLocalNet(algod: Algodv2): Promise<boolean> {
  const params = await algod.getTransactionParams().do()

  return params.genesisID === 'devnet-v1' || params.genesisID === 'sandnet-v1'
}

/**
 * Gets an account with private key loaded from a KMD wallet of the given name, or alternatively creates one with funds in it via a KMD wallet of the given name.
 *
 * This is useful to get idempotent accounts from a local sandbox without having to specify the private key (which will change when resetting the sandbox).
 *
 * This significantly speeds up local dev time and improves experience since you can write code that *just works* first go without manual config in a fresh sandbox.
 *
 * If this is used via @see {getAccount}, then you can even use the same code that runs on production without changes for local development!
 *
 * @param walletAccount The wallet details with:
 *   * `name`: The name of the wallet to retrieve / create
 *   * `fundWith`: The number of Algos to fund the account with it it gets created, if not specified then 1000 Algos will be funded from the dispenser account @see {getDispenserAccount}
 * @param algod An algod client
 * @param kmdClient A KMD client, if not specified then a default KMD client will be loaded from environment variables @see {getAlgoKmdClient}
 *
 * @returns An Algorand account with private key loaded - either one that already existed in the given KMD wallet, or a new one that is funded for you
 */
export async function getOrCreateKmdWalletAccount(
  walletAccount: { name: string; fundWith?: AlgoAmount },
  algod: Algodv2,
  kmdClient?: Kmd,
): Promise<Account> {
  const kmd = kmdClient ?? getAlgoKmdClient()

  // Get an existing account from the KMD wallet
  const existing = await getKmdWalletAccount(walletAccount, algod, kmd)
  if (existing) {
    return existing
  }

  // None existed: create the KMD wallet instead
  const walletId = (await kmd.createWallet(walletAccount.name, '')).wallet.id
  const walletHandle = (await kmd.initWalletHandle(walletId, '')).wallet_handle_token
  await kmd.generateKey(walletHandle)

  // Get the account from the new KMD wallet
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const account = (await getKmdWalletAccount(walletAccount, algod, kmd))!

  AlgoKitConfig.logger.info(
    `Couldn't find existing account in Sandbox under name '${walletAccount.name}'; created account ${
      account.addr
    } with keys stored in KMD and funding with ${walletAccount.fundWith?.algos ?? 1000} ALGOs`,
  )

  // Fund the account from the dispenser
  await transferAlgos(
    {
      amount: walletAccount.fundWith ?? AlgoAmount.Algos(1000),
      from: await getDispenserAccount(algod),
      to: account.addr,
    },
    algod,
  )

  return account
}

/**
 * Returns an Algorand account with private key loaded from the given KMD wallet (identified by name).
 *
 * @param walletAccount The details of the wallet, with:
 *   * `name`: The name of the wallet to retrieve an account from
 *   * `predicate`: An optional filter to use to find the account (otherwise it will return a random account from the wallet)
 * @param algod An algod client
 * @param kmdClient A KMD client, if not specified then a default KMD client will be loaded from environment variables @see {getAlgoKmdClient}
 * @example Get default funded account in a LocalNet
 *
 * ```
 * const defaultDispenserAccount = await getKmdWalletAccount(algod,
 *   'unencrypted-default-wallet',
 *   a => a.status !== 'Offline' && a.amount > 1_000_000_000
 * )
 * ```
 */
export async function getKmdWalletAccount(
  walletAccount: {
    name: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    predicate?: (account: Record<string, any>) => boolean
  },
  algod: Algodv2,
  kmdClient?: Kmd,
): Promise<Account | undefined> {
  const { name, predicate } = walletAccount
  const kmd = kmdClient ?? getAlgoKmdClient()
  const wallets = await kmd.listWallets()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wallet = wallets.wallets.filter((w: any) => w.name === name)
  if (wallet.length === 0) {
    return undefined
  }

  const walletId = wallet[0].id

  const walletHandle = (await kmd.initWalletHandle(walletId, '')).wallet_handle_token
  const keyIds = (await kmd.listKeys(walletHandle)).addresses

  let i = 0
  if (predicate) {
    for (i = 0; i < keyIds.length; i++) {
      const key = keyIds[i]
      const account = await algod.accountInformation(key).do()
      if (predicate(account)) {
        break
      }
    }
  }

  if (i >= keyIds.length) {
    return undefined
  }

  const accountKey = (await kmd.exportKey(walletHandle, '', keyIds[i])).private_key

  const accountMnemonic = algosdk.secretKeyToMnemonic(accountKey)
  return getAccountFromMnemonic(accountMnemonic)
}

/**
 * Returns an Algorand account with private key loaded for the default LocalNet dispenser account (that can be used to fund other accounts)
 *
 * @param algod An algod client
 * @param kmdClient A KMD client, if not specified then a default KMD client will be loaded from environment variables @see {getAlgoKmdClient}
 */
export async function getLocalNetDispenserAccount(algod: Algodv2, kmdClient?: Kmd): Promise<Account> {
  if (!(await isLocalNet(algod))) {
    throw "Can't get default account from non LocalNet network"
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return (await getKmdWalletAccount(
    { name: 'unencrypted-default-wallet', predicate: (a) => a.status !== 'Offline' && a.amount > 1_000_000_000 },
    algod,
    kmdClient,
  ))!
}
