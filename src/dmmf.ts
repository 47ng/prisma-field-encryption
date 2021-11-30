import { Prisma } from '@prisma/client'
import type { DMMF, FieldConfiguration } from './types'

export interface ConnectionDescriptor {
  modelName: string
  isList: boolean
}

export interface DMMFModelDescriptor {
  fields: Record<string, FieldConfiguration> // key: field name
  connections: Record<string, ConnectionDescriptor> // key: field name
}

export type DMMFModels = Record<string, DMMFModelDescriptor> // key: model name

export function analyseDMMF(dmmf: DMMF = Prisma.dmmf): DMMFModels {
  // todo: Make it robust against changes in the DMMF structure
  // (can happen as it's an undocumented API)
  // - Prisma.dmmf does not exist
  // - Models are not located there, or empty -> warning
  // - Model objects don't conform to what we need (parse with zod)

  const allModels = dmmf.datamodel.models

  return allModels.reduce<DMMFModels>((output, model) => {
    const modelDescriptor: DMMFModelDescriptor = {
      fields: model.fields.reduce<DMMFModelDescriptor['fields']>(
        (fields, field) => {
          const fieldConfig = parseAnnotation(
            field.documentation,
            model.name,
            field.name
          )
          return fieldConfig ? { ...fields, [field.name]: fieldConfig } : fields
        },
        {}
      ),
      connections: model.fields.reduce<DMMFModelDescriptor['connections']>(
        (connections, field) => {
          const targetModel = allModels.find(model => field.type === model.name)
          if (!targetModel) {
            return connections
          }
          const connection: ConnectionDescriptor = {
            modelName: targetModel.name,
            isList: field.isList
          }
          return {
            ...connections,
            [field.name]: connection
          }
        },
        {}
      )
    }
    return {
      ...output,
      [model.name]: modelDescriptor
    }
  }, {})
}

// --

const annotationRegex = /@encrypted(?<query>\?[\w=&]+)?/

export function parseAnnotation(
  annotation = '',
  model?: string,
  field?: string
): FieldConfiguration | null {
  const match = annotation.match(annotationRegex)
  if (!match) {
    return null
  }
  const query = new URLSearchParams(match.groups?.query ?? '')
  const readonly = query.get('readonly') !== null
  const strict = query.get('strict') !== null
  /* istanbul ignore next */
  if (process.env.NODE_ENV === 'development' && strict && readonly) {
    console.warn(
      `[prisma-field-encryption] Warning: the field ${model}.${field} defines both 'strict' and 'readonly'.\nStrict decryption is disabled in read-only mode (to handle new unencrypted data).`
    )
  }
  return {
    encrypt: !readonly,
    strictDecryption: !readonly && strict
  }
}
