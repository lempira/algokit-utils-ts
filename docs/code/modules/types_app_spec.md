[@algorandfoundation/algokit-utils](../README.md) / types/app-spec

# Module: types/app-spec

## Table of contents

### Interfaces

- [AppSources](../interfaces/types_app_spec.AppSources.md)
- [AppSpec](../interfaces/types_app_spec.AppSpec.md)
- [CallConfig](../interfaces/types_app_spec.CallConfig.md)
- [DeclaredSchemaValueSpec](../interfaces/types_app_spec.DeclaredSchemaValueSpec.md)
- [Hint](../interfaces/types_app_spec.Hint.md)
- [ReservedSchemaValueSpec](../interfaces/types_app_spec.ReservedSchemaValueSpec.md)
- [Schema](../interfaces/types_app_spec.Schema.md)
- [SchemaSpec](../interfaces/types_app_spec.SchemaSpec.md)
- [StateSchemaSpec](../interfaces/types_app_spec.StateSchemaSpec.md)
- [Struct](../interfaces/types_app_spec.Struct.md)

### Type Aliases

- [ABIType](types_app_spec.md#abitype)
- [AVMType](types_app_spec.md#avmtype)
- [CallConfigValue](types_app_spec.md#callconfigvalue)
- [DefaultArgument](types_app_spec.md#defaultargument)
- [FieldName](types_app_spec.md#fieldname)
- [HintSpec](types_app_spec.md#hintspec)
- [StateSchema](types_app_spec.md#stateschema)
- [StructElement](types_app_spec.md#structelement)

### Functions

- [arc32ToArc56](types_app_spec.md#arc32toarc56)

## Type Aliases

### ABIType

Ƭ **ABIType**: `string`

The string name of an ABI type

#### Defined in

[src/types/app-spec.ts:212](https://github.com/lempira/algokit-utils-ts/blob/main/src/types/app-spec.ts#L212)

___

### AVMType

Ƭ **AVMType**: ``"uint64"`` \| ``"bytes"``

AVM data type

#### Defined in

[src/types/app-spec.ts:268](https://github.com/lempira/algokit-utils-ts/blob/main/src/types/app-spec.ts#L268)

___

### CallConfigValue

Ƭ **CallConfigValue**: ``"NEVER"`` \| ``"CALL"`` \| ``"CREATE"`` \| ``"ALL"``

The various call configs:
 * `NEVER`: Will not be called
 * `CALL`: Can be called during a non-create call i.e. app id != 0
 * `CREATE`: Can be called during a create call i.e. app id = 0
 * `ALL`: Can be during a create OR non-create call

#### Defined in

[src/types/app-spec.ts:183](https://github.com/lempira/algokit-utils-ts/blob/main/src/types/app-spec.ts#L183)

___

### DefaultArgument

Ƭ **DefaultArgument**: \{ `data`: `ABIMethodParams` ; `source`: ``"abi-method"``  } \| \{ `data`: `string` ; `source`: ``"global-state"``  } \| \{ `data`: `string` ; `source`: ``"local-state"``  } \| \{ `data`: `string` \| `number` ; `source`: ``"constant"``  }

Defines a strategy for obtaining a default value for a given ABI arg.

#### Defined in

[src/types/app-spec.ts:228](https://github.com/lempira/algokit-utils-ts/blob/main/src/types/app-spec.ts#L228)

___

### FieldName

Ƭ **FieldName**: `string`

The name of a field

#### Defined in

[src/types/app-spec.ts:209](https://github.com/lempira/algokit-utils-ts/blob/main/src/types/app-spec.ts#L209)

___

### HintSpec

Ƭ **HintSpec**: `Record`\<`string`, [`Hint`](../interfaces/types_app_spec.Hint.md)\>

A lookup of encoded method call spec to hint

#### Defined in

[src/types/app-spec.ts:167](https://github.com/lempira/algokit-utils-ts/blob/main/src/types/app-spec.ts#L167)

___

### StateSchema

Ƭ **StateSchema**: `Object`

Schema spec summary for global or local storage

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `num_byte_slices` | `number` | Number of byte slots |
| `num_uints` | `number` | Number of uint slots |

#### Defined in

[src/types/app-spec.ts:317](https://github.com/lempira/algokit-utils-ts/blob/main/src/types/app-spec.ts#L317)

___

### StructElement

Ƭ **StructElement**: [[`FieldName`](types_app_spec.md#fieldname), [`ABIType`](types_app_spec.md#abitype)]

The elements of the struct/tuple: `FieldName`, `ABIType`

#### Defined in

[src/types/app-spec.ts:215](https://github.com/lempira/algokit-utils-ts/blob/main/src/types/app-spec.ts#L215)

## Functions

### arc32ToArc56

▸ **arc32ToArc56**(`appSpec`): [`Arc56Contract`](../interfaces/types_app_arc56.Arc56Contract.md)

Converts an ARC-32 Application Specification to an ARC-56 Contract

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `appSpec` | [`AppSpec`](../interfaces/types_app_spec.AppSpec.md) | The ARC-32 Application Specification |

#### Returns

[`Arc56Contract`](../interfaces/types_app_arc56.Arc56Contract.md)

The ARC-56 Contract

**`Example`**

```typescript
const arc56AppSpec = arc32ToArc56(arc32AppSpec)
```

#### Defined in

[src/types/app-spec.ts:16](https://github.com/lempira/algokit-utils-ts/blob/main/src/types/app-spec.ts#L16)
