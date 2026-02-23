import { newHttpBatchRpcSession } from 'capnweb'
import type { Api } from '../../server/src/rpc'

export type RpcApi = ReturnType<typeof newHttpBatchRpcSession<Api>>

export function createApi(serverUrl: string): RpcApi {
  const rpcUrl = serverUrl.replace(/\/$/, '') + '/rpc'
  return newHttpBatchRpcSession<Api>(rpcUrl)
}
