import algosdk from 'algosdk'
import { sendAtomicTransactionComposer } from './transaction/transaction'

export type CommonTxnParams = {
  /** The address sending the transaction */
  sender: string
  /** The function used to sign transactions */
  signer?: algosdk.TransactionSigner
  /** Change the signing key of the sender to the given address */
  rekeyTo?: string
  /** Note to attach to the transaction*/
  note?: Uint8Array
  /** Prevent multiple transactions with the same lease being included within the validity window */
  lease?: Uint8Array
  /** The transaction fee. In most cases you want to use `extraFee` unless setting the fee to 0 to be covered by another transaction */
  flatFee?: number
  /** The fee to pay IN ADDITION to the suggested fee. Useful for covering inner transaction fees */
  extraFee?: number
  /** Throw an error if the fee for the transaction is more than this amount */
  maxFee?: number
  /** How many rounds the transaction should be valid for */
  validityWindow?: number
  /**
   * Set the first round this transaction is valid.
   * If left undefined, the value from algod will be used.
   * Only set this when you intentionally want this to be some time in the future
   */
  firstValidRound?: number
  /** The last round this transaction is valid. It is recommended to use validityWindow instead */
  lastValidRound?: number
}

export type PayTxnParams = CommonTxnParams & {
  /** That account that will receive the ALGO */
  to: string
  /** Amount, in microALGO, to send */
  amount: number
}

export type AssetCreateParams = CommonTxnParams & {
  /** The total amount of the smallest divisible unit to create */
  total: number
  /** The amount of decimal places the asset should have */
  decimals?: number
  /** Whether the asset is frozen by default in the creator address */
  defaultFrozen?: boolean
  /** The address that can change the manager, reserve, clawback, and freeze addresses */
  manager?: string
  /** The address that holds the uncirculated supply */
  reserve?: string
  /** The address that can freeze the asset in any account */
  freeze?: string
  /** The address that can clawback the asset from any account */
  clawback?: string
  /** The short ticker name for the asset */
  unitName?: string
  /** The full name of the asset */
  assetName?: string
  /** The metadata URL for the asset */
  url?: string
  /** Hash of the metadata contained in the metadata URL */
  metadataHash?: Uint8Array
}

export type AssetConfigParams = CommonTxnParams & {
  /** ID of the asset */
  assetID: number
  /** The address that can change the manager, reserve, clawback, and freeze addresses */
  manager?: string
  /** The address that holds the uncirculated supply */
  reserve?: string
  /** The address that can freeze the asset in any account */
  freeze?: string
  /** The address that can clawback the asset from any account */
  clawback?: string
}

export type AssetFreezeParams = CommonTxnParams & {
  /** The ID of the asset */
  assetID: number
  /** The account to freeze or unfreeze */
  account: string
  /** Whether the assets in the account should be frozen */
  frozen: boolean
}

export type AssetDestroyParams = CommonTxnParams & {
  /** ID of the asset */
  assetID: number
}

export type KeyRegParams = CommonTxnParams & {
  voteKey?: Uint8Array
  selectionKey?: Uint8Array
  voteFirst: number
  voteLast: number
  voteKeyDilution: number
  nonParticipation: boolean
  stateProofKey?: Uint8Array
}

export type AssetTransferParams = CommonTxnParams & {
  /** ID of the asset */
  assetID: number
  /** Amount of the asset to transfer (smallest divisible unit) */
  amount: number
  /** The account to send the asset to */
  to: string
  /** The account to take the asset from */
  clawbackTarget?: string
  /** The account to close the asset to */
  closeAssetTo?: string
}

export type AssetOptInParams = CommonTxnParams & {
  /** ID of the asset */
  assetID: number
}

export type AppCallParams = CommonTxnParams & {
  /** The [OnComplete](https://developer.algorand.org/docs/get-details/dapps/avm/teal/specification/#oncomplete) */
  onComplete?: algosdk.OnApplicationComplete
  /** ID of the application */
  appID?: number
  /** The program to execute for all OnCompletes other than ClearState */
  approvalProgram?: Uint8Array
  /** The program to execute for ClearState OnComplete */
  clearProgram?: Uint8Array
  /** The state schema for the app. This is immutable. */
  schema?: {
    /** The number of integers saved in global state */
    globalUints: number
    /** The number of byte slices saved in global state */
    globalByteSlices: number
    /** The number of integers saved in local state */
    localUints: number
    /** The number of byte slices saved in local state */
    localByteSlices: number
  }
  /** Application arguments */
  args?: Uint8Array[]
  /** Account references */
  accountReferences?: string[]
  /** App references */
  appReferences?: number[]
  /** Asset references */
  assetReferences?: number[]
  /** Number of extra pages required for the programs */
  extraPages?: number
  /** Box references */
  boxReferences?: algosdk.BoxReference[]
}

export type MethodCallParams = CommonTxnParams &
  Omit<AppCallParams, 'args'> & {
    /** ID of the application */
    appID: number
    /** The ABI method to call */
    method: algosdk.ABIMethod
    /** Arguments to the ABI method */
    args?: (algosdk.ABIValue | Txn)[]
  }

type Txn =
  | (PayTxnParams & { type: 'pay' })
  | (AssetCreateParams & { type: 'assetCreate' })
  | (AssetConfigParams & { type: 'assetConfig' })
  | (AssetFreezeParams & { type: 'assetFreeze' })
  | (AssetDestroyParams & { type: 'assetDestroy' })
  | (AssetTransferParams & { type: 'assetTransfer' })
  | (AssetOptInParams & { type: 'assetOptIn' })
  | (AppCallParams & { type: 'appCall' })
  | (KeyRegParams & { type: 'keyReg' })
  | (algosdk.TransactionWithSigner & { type: 'txnWithSigner' })
  | { atc: algosdk.AtomicTransactionComposer; type: 'atc' }
  | (MethodCallParams & { type: 'methodCall' })

export default class AlgokitComposer {
  /** Map of txid to ABI method */
  private txnMethodMap: Map<string, algosdk.ABIMethod> = new Map()

  /** Transactions that have not yet been composed */
  private txns: Txn[] = []

  /** The underlying AtomicTransactionComposer */
  atc: algosdk.AtomicTransactionComposer

  /** The algod client used by the composer for suggestedParams */
  algod: algosdk.Algodv2

  /** An async function that will return suggestedParams */
  getSuggestedParams: () => Promise<algosdk.SuggestedParams>

  /** A function that takes in an address and return a signer function for that address */
  getSigner: (address: string) => algosdk.TransactionSigner

  /** The default transaction validity window */
  defaultValidityWindow = 10

  constructor(
    algod: algosdk.Algodv2,
    getSigner: (address: string) => algosdk.TransactionSigner,
    getSuggestedParams?: () => Promise<algosdk.SuggestedParams>,
  ) {
    this.atc = new algosdk.AtomicTransactionComposer()
    this.algod = algod
    const defaultGetSendParams = () => algod.getTransactionParams().do()
    this.getSuggestedParams = getSuggestedParams ?? defaultGetSendParams
    this.getSigner = getSigner
  }

  addPayment(params: PayTxnParams): AlgokitComposer {
    this.txns.push({ ...params, type: 'pay' })

    return this
  }

  addAssetCreate(params: AssetCreateParams): AlgokitComposer {
    this.txns.push({ ...params, type: 'assetCreate' })

    return this
  }

  addAssetConfig(params: AssetConfigParams): AlgokitComposer {
    this.txns.push({ ...params, type: 'assetConfig' })

    return this
  }

  addAssetFreeze(params: AssetFreezeParams): AlgokitComposer {
    this.txns.push({ ...params, type: 'assetFreeze' })

    return this
  }

  addAssetDestroy(params: AssetDestroyParams): AlgokitComposer {
    this.txns.push({ ...params, type: 'assetDestroy' })

    return this
  }

  addAssetTransfer(params: AssetTransferParams): AlgokitComposer {
    this.txns.push({ ...params, type: 'assetTransfer' })

    return this
  }

  addAssetOptIn(params: AssetOptInParams): AlgokitComposer {
    this.txns.push({ ...params, type: 'assetOptIn' })

    return this
  }

  addAppCall(params: AppCallParams): AlgokitComposer {
    this.txns.push({ ...params, type: 'appCall' })

    return this
  }

  addKeyReg(params: KeyRegParams): AlgokitComposer {
    this.txns.push({ ...params, type: 'keyReg' })

    return this
  }

  addAtc(atc: algosdk.AtomicTransactionComposer): AlgokitComposer {
    this.txns.push({ atc, type: 'atc' })
    return this
  }

  addMethodCall(params: MethodCallParams) {
    this.txns.push({ ...params, type: 'methodCall' })
    return this
  }

  private buildAtc(atc: algosdk.AtomicTransactionComposer): algosdk.TransactionWithSigner[] {
    const group = atc.buildGroup()

    const txnWithSigners = group.map((ts) => {
      ts.txn.group = undefined
      return ts
    })

    const method = atc['methodCalls'].get(group.length - 1)
    if (method) this.txnMethodMap.set(txnWithSigners.at(-1)!.txn.txID(), method)

    return txnWithSigners
  }

  private commonTxnBuildStep(params: CommonTxnParams, txn: algosdk.Transaction, suggestedParams: algosdk.SuggestedParams) {
    if (params.lease) txn.addLease(params.lease)
    if (params.rekeyTo) txn.addRekey(params.rekeyTo)
    if (params.note) txn.note = params.note

    if (params.firstValidRound) {
      txn.firstRound = params.firstValidRound
    }

    if (params.lastValidRound) {
      txn.lastRound = params.lastValidRound
    } else {
      txn.lastRound = txn.firstRound + (params.validityWindow ?? this.defaultValidityWindow)
    }

    if (params.flatFee !== undefined && params.extraFee !== undefined) {
      throw Error('Cannot set both flatFee and extraFee')
    }

    if (params.flatFee !== undefined) {
      txn.fee = params.flatFee
    } else {
      txn.fee = txn.estimateSize() * suggestedParams.fee || algosdk.ALGORAND_MIN_TX_FEE
      if (params.extraFee) txn.fee += params.extraFee
    }

    if (params.maxFee !== undefined && txn.fee > params.maxFee) {
      throw Error(`Transaction fee ${txn.fee} is greater than maxFee ${params.maxFee}`)
    }

    return txn
  }

  private buildMethodCall(params: MethodCallParams, suggestedParams: algosdk.SuggestedParams): algosdk.TransactionWithSigner[] {
    const methodArgs: algosdk.ABIArgument[] = []
    /** When a methodCall is encountered, we need to offset the arg index because one method call might have multiple txns */
    let argOffset = 0

    const isAbiValue = (x: unknown): x is algosdk.ABIValue => {
      if (Array.isArray(x)) return x.length == 0 || x.every(isAbiValue)

      return ['boolean', 'number', 'bigint', 'string', 'Uint8Array'].includes(typeof x)
    }

    params.args?.forEach((arg, i) => {
      if (isAbiValue(arg)) {
        methodArgs.push(arg)
        return
      }

      if (Object.values(algosdk.ABITransactionType).includes(params.method.args[i + argOffset].type as algosdk.ABITransactionType)) {
        let txn: algosdk.Transaction
        switch (arg.type) {
          case 'methodCall': {
            const tempTxnWithSigners = this.buildMethodCall(arg, suggestedParams)
            methodArgs.push(...tempTxnWithSigners)
            argOffset += tempTxnWithSigners.length - 1
            return
          }
          case 'appCall':
            txn = this.buildAppCall(arg, suggestedParams)
            break
          case 'pay':
            txn = this.buildPayment(arg, suggestedParams)
            break
          case 'assetOptIn':
            txn = this.buildAssetTransfer({ ...arg, to: arg.sender, amount: 0 }, suggestedParams)
            break
          case 'assetCreate':
            txn = this.buildAssetCreate(arg, suggestedParams)
            break
          case 'assetConfig':
            txn = this.buildAssetConfig(arg, suggestedParams)
            break
          case 'assetDestroy':
            txn = this.buildAssetDestroy(arg, suggestedParams)
            break
          case 'assetFreeze':
            txn = this.buildAssetFreeze(arg, suggestedParams)
            break
          case 'assetTransfer':
            txn = this.buildAssetTransfer(arg, suggestedParams)
            break
          case 'keyReg':
            txn = this.buildKeyReg(arg, suggestedParams)
            break
          default:
            throw Error(`Unsupported method arg transaction type: ${arg.type}`)
        }

        methodArgs.push({ txn, signer: params.signer || this.getSigner(params.sender) })
        return
      }

      throw Error(`Unsupported method arg: ${arg}`)
    })

    const methodAtc = new algosdk.AtomicTransactionComposer()

    methodAtc.addMethodCall({
      ...params,
      suggestedParams,
      signer: params.signer ?? this.getSigner(params.sender),
      methodArgs: methodArgs,
    })

    return this.buildAtc(methodAtc)
  }

  private buildPayment(params: PayTxnParams, suggestedParams: algosdk.SuggestedParams) {
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: params.sender,
      to: params.to,
      amount: params.amount,
      suggestedParams,
    })

    return this.commonTxnBuildStep(params, txn, suggestedParams)
  }

  private buildAssetCreate(params: AssetCreateParams, suggestedParams: algosdk.SuggestedParams) {
    const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
      from: params.sender,
      total: params.total,
      decimals: params.decimals ?? 0,
      suggestedParams,
      defaultFrozen: params.defaultFrozen ?? false,
    })

    return this.commonTxnBuildStep(params, txn, suggestedParams)
  }

  private buildAppCall(params: AppCallParams, suggestedParams: algosdk.SuggestedParams) {
    const sdkParams = {
      from: params.sender,
      suggestedParams,
      onComplete: params.onComplete,
      approvalProgram: params.approvalProgram,
      clearProgram: params.clearProgram,
      appArgs: params.args,
      accounts: params.accountReferences,
      foreignApps: params.appReferences,
      foreignAssets: params.assetReferences,
      extraPages: params.extraPages,
      numLocalInts: params.schema?.localUints || 0,
      numLocalByteSlices: params.schema?.localByteSlices || 0,
      numGlobalInts: params.schema?.globalUints || 0,
      numGlobalByteSlices: params.schema?.globalByteSlices || 0,
    }

    let txn: algosdk.Transaction

    const onComplete = params.onComplete || algosdk.OnApplicationComplete.NoOpOC

    if (!params.appID) {
      if (params.approvalProgram === undefined || params.clearProgram === undefined) {
        throw new Error('approvalProgram and clearProgram are required for application creation')
      }

      txn = algosdk.makeApplicationCreateTxnFromObject({
        ...sdkParams,
        onComplete,
        approvalProgram: params.approvalProgram,
        clearProgram: params.clearProgram,
      })
    }

    txn = algosdk.makeApplicationCallTxnFromObject({ ...sdkParams, onComplete, appIndex: params.appID! })

    return this.commonTxnBuildStep(params, txn, suggestedParams)
  }

  private buildAssetConfig(params: AssetConfigParams, suggestedParams: algosdk.SuggestedParams) {
    const txn = algosdk.makeAssetConfigTxnWithSuggestedParamsFromObject({
      from: params.sender,
      assetIndex: params.assetID,
      suggestedParams,
      manager: params.manager,
      reserve: params.reserve,
      freeze: params.freeze,
      clawback: params.clawback,
      strictEmptyAddressChecking: false,
    })

    return this.commonTxnBuildStep(params, txn, suggestedParams)
  }

  private buildAssetDestroy(params: AssetDestroyParams, suggestedParams: algosdk.SuggestedParams) {
    const txn = algosdk.makeAssetDestroyTxnWithSuggestedParamsFromObject({
      from: params.sender,
      assetIndex: params.assetID,
      suggestedParams,
    })

    return this.commonTxnBuildStep(params, txn, suggestedParams)
  }

  private buildAssetFreeze(params: AssetFreezeParams, suggestedParams: algosdk.SuggestedParams) {
    const txn = algosdk.makeAssetFreezeTxnWithSuggestedParamsFromObject({
      from: params.sender,
      assetIndex: params.assetID,
      freezeTarget: params.account,
      freezeState: params.frozen,
      suggestedParams,
    })

    return this.commonTxnBuildStep(params, txn, suggestedParams)
  }

  private buildAssetTransfer(params: AssetTransferParams, suggestedParams: algosdk.SuggestedParams) {
    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: params.sender,
      to: params.to,
      assetIndex: params.assetID,
      amount: params.amount,
      suggestedParams,
      closeRemainderTo: params.closeAssetTo,
      revocationTarget: params.clawbackTarget,
    })

    return this.commonTxnBuildStep(params, txn, suggestedParams)
  }

  private buildKeyReg(params: KeyRegParams, suggestedParams: algosdk.SuggestedParams) {
    let txn: algosdk.Transaction

    if (params.nonParticipation) {
      txn = algosdk.makeKeyRegistrationTxnWithSuggestedParams(
        params.sender,
        params.note,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        suggestedParams,
        params.rekeyTo,
        true,
        undefined,
      )
    } else {
      txn = algosdk.makeKeyRegistrationTxnWithSuggestedParams(
        params.sender,
        params.note,
        params.voteKey!,
        params.selectionKey!,
        params.voteFirst,
        params.voteLast,
        params.voteKeyDilution,
        suggestedParams,
        params.rekeyTo,
        false,
        params.stateProofKey,
      )
    }

    return this.commonTxnBuildStep(params, txn, suggestedParams)
  }

  private buildTxn(txn: Txn, suggestedParams: algosdk.SuggestedParams): algosdk.TransactionWithSigner[] {
    if (txn.type === 'txnWithSigner') {
      return [txn]
    }

    if (txn.type === 'atc') {
      return this.buildAtc(txn.atc)
    }

    if (txn.type === 'methodCall') {
      return this.buildMethodCall(txn, suggestedParams)
    }

    const signer = txn.signer ?? this.getSigner(txn.sender)

    switch (txn.type) {
      case 'pay': {
        const payment = this.buildPayment(txn, suggestedParams)
        return [{ txn: payment, signer }]
      }
      case 'assetCreate': {
        const assetCreate = this.buildAssetCreate(txn, suggestedParams)
        return [{ txn: assetCreate, signer }]
      }
      case 'appCall': {
        const appCall = this.buildAppCall(txn, suggestedParams)
        return [{ txn: appCall, signer }]
      }
      case 'assetConfig': {
        const assetConfig = this.buildAssetConfig(txn, suggestedParams)
        return [{ txn: assetConfig, signer }]
      }
      case 'assetDestroy': {
        const assetDestroy = this.buildAssetDestroy(txn, suggestedParams)
        return [{ txn: assetDestroy, signer }]
      }
      case 'assetFreeze': {
        const assetFreeze = this.buildAssetFreeze(txn, suggestedParams)
        return [{ txn: assetFreeze, signer }]
      }
      case 'assetTransfer': {
        const assetTransfer = this.buildAssetTransfer(txn, suggestedParams)
        return [{ txn: assetTransfer, signer }]
      }
      case 'assetOptIn': {
        const assetTransfer = this.buildAssetTransfer({ ...txn, to: txn.sender, amount: 0 }, suggestedParams)
        return [{ txn: assetTransfer, signer }]
      }
      case 'keyReg': {
        const keyReg = this.buildKeyReg(txn, suggestedParams)
        return [{ txn: keyReg, signer }]
      }
      default:
        throw Error(`Unsupported txn type`)
    }
  }

  /** Compose all of the transactions in a single atomic transaction group */
  async buildGroup() {
    const suggestedParams = await this.getSuggestedParams()

    const txnWithSigners: algosdk.TransactionWithSigner[] = []

    this.txns.forEach((txn) => {
      txnWithSigners.push(...this.buildTxn(txn, suggestedParams))
    })

    txnWithSigners.forEach((ts) => {
      this.atc.addTransaction(ts)
    })

    const methodCalls = new Map<number, algosdk.ABIMethod>()

    txnWithSigners.forEach((ts, idx) => {
      const method = this.txnMethodMap.get(ts.txn.txID())
      if (method) methodCalls.set(idx, method)
    })

    this.atc['methodCalls'] = methodCalls

    return this.atc.buildGroup()
  }

  /** Compose the atomic transaction group and send it to the network */
  async execute(params?: {
    /** The number of rounds to wait for confirmation. By default until the latest lastValid has past. */
    maxRoundsToWaitForConfirmation?: number
  }) {
    const group = await this.buildGroup()

    let waitRounds = params?.maxRoundsToWaitForConfirmation

    if (waitRounds === undefined) {
      const lastRound = group.reduce((max, txn) => Math.max(txn.txn.lastRound, max), 0)
      const { firstRound } = await this.getSuggestedParams()
      waitRounds = lastRound - firstRound
    }

    return await sendAtomicTransactionComposer(
      {
        atc: this.atc,
        sendParams: { suppressLog: true, maxRoundsToWaitForConfirmation: waitRounds },
      },
      this.algod,
    )
  }
}
