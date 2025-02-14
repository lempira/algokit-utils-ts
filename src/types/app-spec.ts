import algosdk from 'algosdk'
import { Arc56Contract, Method as Arc56Method, StorageKey, StructField } from './app-arc56'
import ABIContractParams = algosdk.ABIContractParams
import ABIMethodParams = algosdk.ABIMethodParams
import ABIMethod = algosdk.ABIMethod

/**
 * Converts an ARC-32 Application Specification to an ARC-56 Contract format.
 * This function transforms the contract specification from one format to another while preserving
 * all relevant information about methods, state, and contract structure.
 *
 * @param appSpec - The ARC-32 Application Specification to convert
 * @returns An ARC-56 Contract representation of the input specification
 *
 * @example
 * ```typescript
 * const arc32Spec = getARC32Spec() // Your ARC-32 spec
 * const arc56Contract = arc32ToArc56(arc32Spec)
 * ```
 */
export function arc32ToArc56(appSpec: AppSpec): Arc56Contract {
  const arc32Structs = Object.values(appSpec.hints).flatMap((hint) => Object.entries(hint.structs ?? {}))
  const structs = Object.fromEntries(
    arc32Structs.map(([_, struct]) => {
      const fields = struct.elements.map((e) => ({ name: e[0], type: e[1] }))
      return [struct.name, fields]
    }),
  ) satisfies { [structName: string]: StructField[] }
  const hint = (m: ABIMethodParams) => appSpec.hints[new ABIMethod(m).getSignature()] as Hint | undefined
  const actions = (m: ABIMethodParams, type: 'CREATE' | 'CALL') => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
    return hint(m)?.call_config !== undefined ? callConfigToActions(hint(m)?.call_config!, type) : []
  }
  const bareActions = (type: 'CREATE' | 'CALL') => {
    return callConfigToActions(appSpec.bare_call_config, type)
  }
  const callConfigToActions = (c: CallConfig, type: 'CREATE' | 'CALL') => {
    const actions: ('NoOp' | 'OptIn' | 'CloseOut' | 'ClearState' | 'UpdateApplication' | 'DeleteApplication')[] = []
    if (c.close_out && ['ALL', type].includes(c.close_out)) actions.push('CloseOut')
    if (c.delete_application && ['ALL', type].includes(c.delete_application)) actions.push('DeleteApplication')
    if (c.no_op && ['ALL', type].includes(c.no_op)) actions.push('NoOp')
    if (c.opt_in && ['ALL', type].includes(c.opt_in)) actions.push('OptIn')
    if (c.update_application && ['ALL', type].includes(c.update_application)) actions.push('UpdateApplication')
    return actions
  }
  const getDefaultArgValue = (
    type: string,
    defaultArg: DefaultArgument | undefined,
  ): Arc56Contract['methods'][0]['args'][0]['defaultValue'] => {
    if (!defaultArg) return undefined

    if (defaultArg.source === 'abi-method') {
      return {
        source: 'method',
        data: defaultArg.data.name,
      }
    }

    return {
      source: defaultArg.source === 'constant' ? 'literal' : defaultArg.source === 'global-state' ? 'global' : 'local',
      data: Buffer.from(
        typeof defaultArg.data === 'number' ? algosdk.ABIType.from('uint64').encode(defaultArg.data) : defaultArg.data,
      ).toString('base64'),
      type: type === 'string' ? 'AVMString' : type,
    }
  }

  return {
    arcs: [],
    name: appSpec.contract.name,
    desc: appSpec.contract.desc,
    structs: structs,
    methods: appSpec.contract.methods.map(
      (m) =>
        ({
          name: m.name,
          desc: m.desc,
          args: m.args.map((a) => ({
            name: a.name,
            type: a.type,
            desc: a.desc,
            struct: a.name ? hint(m)?.structs?.[a.name]?.name : undefined,
            defaultValue: getDefaultArgValue(a.type, !a.name ? undefined : hint(m)?.default_arguments?.[a.name]),
          })),
          returns: {
            type: m.returns.type,
            desc: m.returns.desc,
            struct: hint(m)?.structs?.output?.name,
          },
          events: [],
          readonly: hint(m)?.read_only,
          actions: {
            create: actions(m, 'CREATE') as Arc56Method['actions']['create'],
            call: actions(m, 'CALL'),
          },
        }) satisfies Arc56Method,
    ),
    state: {
      schema: {
        global: {
          ints: appSpec.state.global.num_uints,
          bytes: appSpec.state.global.num_byte_slices,
        },
        local: {
          ints: appSpec.state.local.num_uints,
          bytes: appSpec.state.local.num_byte_slices,
        },
      },
      keys: {
        global: Object.fromEntries(
          Object.entries(appSpec.schema.global.declared).map((s) => [
            s[0],
            {
              key: Buffer.from(s[1].key, 'utf-8').toString('base64'),
              keyType: 'AVMString',
              valueType: s[1].type === 'uint64' ? 'AVMUint64' : 'AVMBytes',
              desc: s[1].descr,
            } satisfies StorageKey,
          ]),
        ),
        local: Object.fromEntries(
          Object.entries(appSpec.schema.local.declared).map((s) => [
            s[0],
            {
              key: Buffer.from(s[1].key, 'utf-8').toString('base64'),
              keyType: 'AVMString',
              valueType: s[1].type === 'uint64' ? 'AVMUint64' : 'AVMBytes',
              desc: s[1].descr,
            } satisfies StorageKey,
          ]),
        ),
        box: {},
      },
      maps: {
        global: {},
        local: {},
        box: {},
      },
    },
    source: appSpec.source,
    bareActions: {
      create: bareActions('CREATE') as unknown as Arc56Contract['bareActions']['create'],
      call: bareActions('CALL'),
    },
    byteCode: undefined,
    compilerInfo: undefined,
    events: undefined,
    networks: undefined,
    scratchVariables: undefined,
    sourceInfo: undefined,
    templateVariables: undefined,
  } satisfies Arc56Contract
}

/**
 * An ARC-0032 Application Specification.
 * Represents the complete specification of an Algorand smart contract following the ARC-0032 standard.
 * @see {@link https://github.com/algorandfoundation/ARCs/pull/150}
 */
export interface AppSpec {
  /** Method call hints providing additional information about contract methods */
  hints: HintSpec
  /** The TEAL source code for both approval and clear programs */
  source: AppSources
  /**
   * The ABI-0004 contract definition containing method specifications
   * @see {@link https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0004.md}
   */
  contract: ABIContractParams
  /** Detailed schema specification for local and global state */
  schema: SchemaSpec
  /** Summary of schema allocation values for local and global state */
  state: StateSchemaSpec
  /** Configuration for bare calls (non-ABI calls with no arguments) */
  bare_call_config: CallConfig
}

/** A mapping of encoded method call specifications to their corresponding hints */
export type HintSpec = Record<string, Hint>

/**
 * Contains the TEAL source code for a contract's programs
 */
export interface AppSources {
  /** The TEAL source code for the approval program */
  approval: string
  /** The TEAL source code for the clear program */
  clear: string
}

/**
 * Defines when a method can be called in the contract lifecycle:
 * - 'NEVER': Will not be called
 * - 'CALL': Can be called during a non-create call (app id != 0)
 * - 'CREATE': Can be called during a create call (app id = 0)
 * - 'ALL': Can be called during both create and non-create calls
 */
export type CallConfigValue = 'NEVER' | 'CALL' | 'CREATE' | 'ALL'

/**
 * Configuration specifying when different types of calls can be made to the contract
 */
export interface CallConfig {
  /** Configuration for NoOp calls */
  no_op?: CallConfigValue
  /** Configuration for Opt-in calls */
  opt_in?: CallConfigValue
  /** Configuration for Close out calls */
  close_out?: CallConfigValue
  /** Configuration for Update application calls */
  update_application?: CallConfigValue
  /** Configuration for Delete application calls */
  delete_application?: CallConfigValue
}

/**
 * Additional information about a method call to assist in client generation
 */
export interface Hint {
  /** User-defined struct/tuple types used in the method, keyed by parameter name or 'output' for return type */
  structs?: Record<string, Struct>
  /** Indicates if the method is read-only */
  read_only?: boolean
  /** Default values for method arguments */
  default_arguments?: Record<string, DefaultArgument>
  /** Configuration for when this method can be called */
  call_config: CallConfig
}

/** Name of a field in a struct/tuple */
export type FieldName = string

/** String representation of an ABI type */
export type ABIType = string

/** Tuple representing a struct/tuple element: [fieldName, abiType] */
export type StructElement = [FieldName, ABIType]

/**
 * Definition of a user-defined struct/tuple type
 */
export interface Struct {
  /** Name of the struct/tuple type */
  name: string
  /** Ordered list of elements that compose the struct/tuple */
  elements: StructElement[]
}

/**
 * Defines different strategies for obtaining default values for ABI arguments
 */
export type DefaultArgument =
  | {
      /** Default value from an ABI method call */
      source: 'abi-method'
      data: ABIMethodParams
    }
  | {
      /** Default value from global state */
      source: 'global-state'
      /** Key of the state variable */
      data: string
    }
  | {
      /** Default value from sender's local state */
      source: 'local-state'
      /** Key of the state variable */
      data: string
    }
  | {
      /** Static constant default value */
      source: 'constant'
      /** The literal default value */
      data: string | number
    }

/** Supported AVM (Algorand Virtual Machine) data types */
export type AVMType = 'uint64' | 'bytes'

/**
 * Specification for a declared schema value
 */
export interface DeclaredSchemaValueSpec {
  /** The AVM type of the value */
  type: AVMType
  /** The storage key name */
  key: string
  /** Description of the variable's purpose */
  descr?: string
  /** Whether the value is static (set only at create time) or dynamic */
  static?: boolean
}

/**
 * Specification for reserved schema storage
 */
export interface ReservedSchemaValueSpec {
  /** The AVM type of the value */
  type: AVMType
  /** Description of the reserved storage's purpose */
  descr: string
  /** Maximum number of storage slots to reserve */
  max_keys: number
}

/**
 * Complete schema specification for contract storage
 */
export interface SchemaSpec {
  /** Schema for per-account local storage */
  local: Schema
  /** Schema for global contract storage */
  global: Schema
}

/**
 * Definition of storage schema
 */
export interface Schema {
  /** Explicitly declared storage variables */
  declared: Record<string, DeclaredSchemaValueSpec>
  /** Reserved storage space for dynamic allocation */
  reserved: Record<string, ReservedSchemaValueSpec>
}

/**
 * Summary of storage allocation requirements
 */
export interface StateSchemaSpec {
  /** Global storage requirements */
  global: StateSchema
  /** Per-account local storage requirements */
  local: StateSchema
}

/**
 * Storage allocation specification
 */
export type StateSchema = {
  /** Number of uint64 slots required */
  num_uints: number
  /** Number of byte slice slots required */
  num_byte_slices: number
}
