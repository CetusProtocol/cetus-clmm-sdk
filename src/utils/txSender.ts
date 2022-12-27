import { AptosAccount, AptosClient, HexString, OptionalTransactionArgs, TransactionBuilderEd25519, TxnBuilderTypes, Types } from 'aptos'

export type SimulationKeys = {
  pubkey: HexString
  address: HexString
}

export function getSimulationKeys(account: AptosAccount): SimulationKeys {
  return {
    pubkey: account.pubKey(),
    address: account.address(),
  }
}
export type OptionTransaction = {
  maxGasAmount?: number
  gasUnitPrice?: number
  // in s
  expireTimestamp?: number
}
// eslint-disable-next-line consistent-return
function toOptionalTransactionArgs(option?: OptionTransaction) {
  if (option) {
    const extraArgs = {} as OptionalTransactionArgs
    if (option.maxGasAmount) {
      extraArgs.maxGasAmount = BigInt(option.maxGasAmount)
    }
    if (option.gasUnitPrice) {
      extraArgs.gasUnitPrice = BigInt(option.gasUnitPrice)
    }
    if (option.expireTimestamp) {
      extraArgs.expireTimestamp = BigInt(option.expireTimestamp)
    }
    return extraArgs
  }
}
export function generateBCSSimulation(pubkey: HexString, rawTxn: TxnBuilderTypes.RawTransaction): Uint8Array {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const txnBuilder = new TransactionBuilderEd25519((_signingMessage: TxnBuilderTypes.SigningMessage) => {
    const invalidSigBytes = new Uint8Array(64)
    return new TxnBuilderTypes.Ed25519Signature(invalidSigBytes)
  }, pubkey.toUint8Array())

  return txnBuilder.sign(rawTxn)
}

// eslint-disable-next-line consistent-return
function toSubmitTransactionRequest(option?: OptionTransaction) {
  if (option) {
    const options = {} as Types.SubmitTransactionRequest
    if (option.maxGasAmount) {
      options.max_gas_amount = option.maxGasAmount.toString()
    }

    if (option.gasUnitPrice) {
      options.gas_unit_price = option.gasUnitPrice.toString()
    }
    if (option.expireTimestamp) {
      options.expiration_timestamp_secs = option.expireTimestamp.toString()
    }
    return options
  }
}

export async function simulatePayloadTxAndLog(
  client: AptosClient,
  keys: SimulationKeys,
  payload: TxnBuilderTypes.TransactionPayload | Types.TransactionPayload_EntryFunctionPayload,
  option?: OptionTransaction,
  log = true
): Promise<Types.UserTransaction> {
  if (payload instanceof TxnBuilderTypes.TransactionPayload) {
    const rawTxn = await client.generateRawTransaction(keys.address, payload, toOptionalTransactionArgs(option))
    const bcsTxn = generateBCSSimulation(keys.pubkey, rawTxn)
    const outputs = await client.submitBCSSimulation(bcsTxn)
    if (log) {
      console.log(outputs[0])
    }
    return outputs[0]
  }
  const pld = payload as Types.TransactionPayload_EntryFunctionPayload
  const txn = await client.generateTransaction(keys.address, pld, toSubmitTransactionRequest(option))
  const transactionSignature: Types.TransactionSignature = {
    type: 'ed25519_signature',
    public_key: keys.pubkey.hex(),
    // use invalid signature for simulation
    signature: HexString.fromUint8Array(new Uint8Array(64)).hex(),
  }

  const request = {
    sender: keys.address.hex(),
    sequence_number: txn.sequence_number.toString(),
    max_gas_amount: txn.max_gas_amount.toString(),
    gas_unit_price: txn.gas_unit_price.toString(),
    expiration_timestamp_secs: txn.expiration_timestamp_secs.toString(),
    payload: pld,
    signature: transactionSignature,
  }
  const outputs = await client.client.transactions.simulateTransaction(request)
  if (log) {
    console.log(outputs[0])
  }
  return outputs[0]
}

export async function simulatePayloadTx(
  client: AptosClient,
  keys: SimulationKeys,
  payload: TxnBuilderTypes.TransactionPayload | Types.TransactionPayload_EntryFunctionPayload,
  option?: OptionTransaction
): Promise<Types.UserTransaction> {
  return simulatePayloadTxAndLog(client, keys, payload, option, false)
}

export async function sendPayloadTx(
  client: AptosClient,
  account: AptosAccount,
  payload: TxnBuilderTypes.TransactionPayload | Types.TransactionPayload_EntryFunctionPayload,
  option?: OptionTransaction
) {
  // eslint-disable-next-line no-return-await, @typescript-eslint/no-use-before-define
  return await sendPayloadTxAndLog(client, account, payload, option, false)
}

export async function sendPayloadTxAndLog(
  client: AptosClient,
  account: AptosAccount,
  payload: TxnBuilderTypes.TransactionPayload | Types.TransactionPayload_EntryFunctionPayload,
  option?: OptionTransaction,
  log = true
) {
  // send BCS transaction
  if (payload instanceof TxnBuilderTypes.TransactionPayloadEntryFunction) {
    // RawTransaction

    const rawTxn = await client.generateRawTransaction(account.address(), payload, toOptionalTransactionArgs(option))
    // Signed BCS representation
    const bcsTxn = AptosClient.generateBCSTransaction(account, rawTxn)
    const txnResult = await client.submitSignedBCSTransaction(bcsTxn)
    await client.waitForTransaction(txnResult.hash)
    const txDetails = (await client.getTransactionByHash(txnResult.hash)) as Types.UserTransaction
    if (log) {
      console.log(txDetails)
    }
    return txDetails
  }
  // send JSON transaction

  const pld = payload as Types.TransactionPayload_EntryFunctionPayload
  // RawTransaction

  const txn = await client.generateTransaction(account.address(), pld, toSubmitTransactionRequest(option))
  // Signed json representation
  const signedTxn = await client.signTransaction(account, txn)
  const txnResult = await client.submitTransaction(signedTxn)
  await client.waitForTransaction(txnResult.hash)
  const txDetails = (await client.getTransactionByHash(txnResult.hash)) as Types.UserTransaction
  if (log) {
    console.log(txDetails)
  }
  return txDetails
}
