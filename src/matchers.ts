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
 * Generate matchers for write operations on a given model.
 *
 * Note: we need the list of all model descriptors to resolve connections.
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

  /**
   * Generate matchers for this model's connections.
   *
   * This allows targeting nested write operations, by visiting
   * the connected models (target model), checking out if we're
   * linking to an encrypted field, and extracting its configuration.
   *
   * @param makePath path generator function to simplify matchers declaration
   */
  const makeLinkedMatchers = (
    makePath: (
      relation: string,
      field: string,
      isList: boolean
    ) => string | false
  ): FieldMatcher[] => {
    return Object.entries(model.connections).reduce<FieldMatcher[]>(
      (matchers, [targetModelName, connections]) => {
        const targetModel = models.find(
          model => model.name.titleCase === targetModelName
        )
        if (!targetModel) {
          return matchers
        }

        /**
         * Note: this model can have many connections to the same targetModel, eg:
         * - User.posts of type Post[]
         * - User.pinnedPost of type Post?
         */
        const targetMatchers = connections.flatMap(
          ({ name: connectionName, isList }) =>
            // Navigate through the target model's fields
            // keep only those that are encrypted and add
            // generate matchers for them.
            Object.keys(targetModel.fields).reduce<FieldMatcher[]>(
              (targetMatchers, targetField) => {
                const path = makePath(connectionName, targetField, isList)
                if (!path) {
                  return targetMatchers
                }
                const fieldConfig = targetModel.fields[targetField]
                if (!fieldConfig?.encrypt) {
                  return targetMatchers
                }
                return [
                  ...targetMatchers,
                  makeFieldMatcher(targetField, path, targetModel)
                ]
              },
              []
            )
        )
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
