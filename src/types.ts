export interface MiddlewareParams<Models, Actions> {
  model?: Models
  action: Actions
  args: any
  dataPath: string[]
  runInTransaction: boolean
}

export interface Configuration<Models extends string> {
  fields: Record<`${Models}.${string}`, true>
  encryptionKey?: string
  decryptionKeys?: string[]
}

export type Middleware<Models, Actions> = (
  params: MiddlewareParams<Models, Actions>,
  next: (params: MiddlewareParams<Models, Actions>) => Promise<any>
) => Promise<any>
