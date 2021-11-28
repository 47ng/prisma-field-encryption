import { Prisma } from '@prisma/client'
import type { DMMF, FieldConfiguration } from './types'
import { lowercaseFirstLetter } from './utils'

const annotationRegex = /@encrypted(?<query>\?[\w=&]+)?/

export function parseAnnotation(annotation = ''): FieldConfiguration | null {
  const match = annotation.match(annotationRegex)
  if (!match) {
    return null
  }
  const query = new URLSearchParams(match.groups?.query ?? '')
  const readonly = query.get('readonly') !== null
  const strict = query.get('strict') !== null
  return {
    encrypt: !readonly,
    strictDecryption: !readonly && strict
  }
}

export interface ConnectionDescriptor {
  name: string // foreign model name (eg: User)
  isList: boolean
}

// Key: model name (eg: User)
export type ModelConnections = Record<string, ConnectionDescriptor>

export interface DMMFModelDescriptor {
  name: {
    titleCase: string
    lowercase: string
    plural: string
  }
  fields: Record<string, FieldConfiguration> // Key: field name
  connections: ModelConnections
}

export interface DMMFAnalysis {
  models: DMMFModelDescriptor[]
}

export function analyseDMMF(dmmf: DMMF = Prisma.dmmf): DMMFAnalysis {
  const modelsWithEncryption = dmmf.datamodel.models.filter(model =>
    model.fields.some(field => field.documentation?.match(annotationRegex))
  )

  const models: DMMFModelDescriptor[] = modelsWithEncryption.map(model => {
    const lowercase = lowercaseFirstLetter(model.name)
    return {
      name: {
        titleCase: model.name,
        lowercase,
        plural:
          dmmf.mappings.modelOperations.find(
            modelOps => modelOps.model === model.name
          )?.plural ?? lowercase + 's'
      },
      fields: model.fields.reduce<DMMFModelDescriptor['fields']>(
        (fields, field) => {
          const fieldConfig = parseAnnotation(field.documentation)
          return fieldConfig ? { ...fields, [field.name]: fieldConfig } : fields
        },
        {}
      ),
      connections: model.fields.reduce<ModelConnections>(
        (connections, field) => {
          const targetModel = modelsWithEncryption.find(
            model => field.type === model.name
          )
          if (!targetModel) {
            return connections
          }
          const connection: ConnectionDescriptor = {
            name: field.name,
            isList: field.isList
          }
          return { ...connections, [targetModel.name]: connection }
        },
        {}
      )
    }
  })

  return {
    models
  }
}
