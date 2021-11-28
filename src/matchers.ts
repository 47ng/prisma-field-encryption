import { Prisma } from '.prisma/client'
import { analyseDMMF, DMMFModelDescriptor } from './dmmf'
import { DMMF, FieldConfiguration, FieldMatcher } from './types'

// Key: operation name (eg: updateMany)
export type OperationsMatchers = Record<string, FieldMatcher[]>
export type ModelMatchers = Record<string, OperationsMatchers>

export type EncryptionOperations =
  | 'create'
  | 'update'
  | 'upsert'
  | 'createMany'
  | 'updateMany'

/**
 * From a given model & field from the DMMF, read annotations & generate
 * associated path matchers for encryption.
 *
 * @param model a model from the DMMF
 * @param field a field belonging to the model
 */
export function getEncryptionMatchersForModel(
  model: DMMFModelDescriptor,
  models: DMMFModelDescriptor[]
): OperationsMatchers {
  const encryptedFields = Object.keys(model.fields).filter(
    field => model.fields[field].encrypt
  )

  const makeFieldMatcher = (
    field: string,
    path: string,
    refModel = model
  ): FieldMatcher => ({
    regexp: new RegExp(`^${path.replace(/\./g, '\\.')}$`),
    fieldConfig: refModel.fields[field]
  })

  const makeLinkedMatchers = (
    makePath: (
      relation: string,
      field: string,
      isList: boolean
    ) => string | false
  ): FieldMatcher[] => {
    return Object.entries(model.connections).reduce<FieldMatcher[]>(
      (matchers, [targetModelName, { name: field, isList }]) => {
        const targetModel = models.find(
          model => model.name.titleCase === targetModelName
        )
        if (!targetModel) {
          return matchers
        }
        const targetMatchers = Object.keys(targetModel.fields).reduce<
          FieldMatcher[]
        >((targetMatchers, targetField) => {
          const path = makePath(field, targetField, isList)
          if (!path) {
            return targetMatchers
          }
          return [
            ...targetMatchers,
            makeFieldMatcher(targetField, path, targetModel)
          ]
        }, [])
        return [...matchers, ...targetMatchers]
      },
      []
    )
  }

  return {
    create: [
      // params.args.data.name
      ...encryptedFields.map(field => makeFieldMatcher(field, `data.${field}`)),
      // params.args.data.posts.create.content
      ...makeLinkedMatchers((rel, field) => `data.${rel}.create.${field}`),
      // params.args.data.posts.create.$.content (if isList)
      ...makeLinkedMatchers(
        (rel, field, isList) => isList && `data.${rel}.create.\\d+.${field}`
      ),
      // params.args.data.posts.connectOrCreate.create.content
      ...makeLinkedMatchers(
        (rel, field) => `data.${rel}.connectOrCreate.create.${field}`
      )
    ],
    createMany: [
      // todo: Implement me.
    ],
    update: [
      // params.args.data.name
      ...encryptedFields.map(field => makeFieldMatcher(field, `data.${field}`)),
      // params.args.data.name.set
      ...encryptedFields.map(field =>
        makeFieldMatcher(field, `data.${field}.set`)
      ),
      // params.args.data.posts.create.content
      ...makeLinkedMatchers((rel, field) => `data.${rel}.create.${field}`),
      // params.args.data.posts.connectOrCreate.create.content
      ...makeLinkedMatchers(
        (rel, field) => `data.${rel}.connectOrCreate.create.${field}`
      ),
      // params.args.data.posts.update.data.content
      ...makeLinkedMatchers((rel, field) => `data.${rel}.update.data.${field}`),
      // params.args.data.posts.update.data.content.set
      ...makeLinkedMatchers(
        (rel, field) => `data.${rel}.update.data.${field}.set`
      ),
      // params.args.data.posts.updateMany.data.content
      ...makeLinkedMatchers(
        (rel, field) => `data.${rel}.updateMany.data.${field}`
      ),
      // params.args.data.posts.updateMany.data.content.set
      ...makeLinkedMatchers(
        (rel, field) => `data.${rel}.updateMany.data.${field}.set`
      ),
      // params.args.data.posts.upsert.create.content
      ...makeLinkedMatchers(
        (rel, field) => `data.${rel}.upsert.create.${field}`
      ),
      // params.args.data.posts.upsert.update.content
      ...makeLinkedMatchers(
        (rel, field) => `data.${rel}.upsert.update.${field}`
      ),
      // params.args.data.posts.upsert.update.content.set
      ...makeLinkedMatchers(
        (rel, field) => `data.${rel}.upsert.update.${field}.set`
      )
    ],
    updateMany: [
      // todo: Implement me.
    ],
    upsert: [
      // todo: Implement me.
    ]
  }
}

/**
 * From a given model & field from the DMMF, read annotations & generate
 * associated path matchers for decryption.
 *
 * @param model a model from the DMMF
 * @param field a field belonging to the model
 */
export function getDecryptionFieldMatchers(): OperationsMatchers {
  // todo: Implement me.
  return {
    findUnique: [],
    findMany: [],
    findFirst: [],
    create: [],
    createMany: [],
    update: [],
    updateMany: [],
    upsert: [],
    delete: [],
    deleteMany: [],
    executeRaw: [],
    queryRaw: [],
    aggregate: [],
    count: []
  }
}

// --

export interface PathMatch {
  path: string
  fieldConfig: FieldConfiguration
}

export function matchPaths(paths: string[], matchers: FieldMatcher[]) {
  return paths.reduce<PathMatch[]>((paths, path) => {
    const match = matchers.find(matcher => matcher.regexp.test(path))
    return match ? [...paths, { path, fieldConfig: match.fieldConfig }] : paths
  }, [])
}

// --

export function configureMatchers(dmmf: DMMF = Prisma.dmmf): {
  encryption: ModelMatchers
  decryption: FieldMatcher[]
} {
  const { models } = analyseDMMF(dmmf)
  const encryption = models.reduce<ModelMatchers>((acc, model) => {
    return {
      ...acc,
      [model.name.titleCase]: getEncryptionMatchersForModel(model, models)
    }
  }, {})
  return {
    encryption,
    decryption: [
      {
        regexp: /.*/,
        fieldConfig: {
          encrypt: false,
          strictDecryption: false
        }
      }
    ]
  }
}
