[@algorandfoundation/algokit-utils](../README.md) / [types/app-client](../modules/types_app_client.md) / ResolveAppByIdBase

# Interface: ResolveAppByIdBase

[types/app-client](../modules/types_app_client.md).ResolveAppByIdBase

Configuration to resolve app by ID

## Hierarchy

- **`ResolveAppByIdBase`**

  ↳ [`ResolveAppById`](types_app_client.ResolveAppById.md)

## Table of contents

### Properties

- [id](types_app_client.ResolveAppByIdBase.md#id)
- [name](types_app_client.ResolveAppByIdBase.md#name)

## Properties

### id

• **id**: `number` \| `bigint`

The id of an existing app to call using this client, or 0 if the app hasn't been created yet

#### Defined in

[src/types/app-client.ts:112](https://github.com/lempira/algokit-utils-ts/blob/main/src/types/app-client.ts#L112)

___

### name

• `Optional` **name**: `string`

The optional name to use to mark the app when deploying `ApplicationClient.deploy` (default: uses the name in the ABI contract)

#### Defined in

[src/types/app-client.ts:114](https://github.com/lempira/algokit-utils-ts/blob/main/src/types/app-client.ts#L114)
