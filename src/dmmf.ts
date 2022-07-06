import { errors, warnings } from './errors'
import { DMMFDocument, dmmfDocumentParser, FieldConfiguration } from './types'

export interface ConnectionDescriptor {
  modelName: string
  isList: boolean
}

export interface DMMFModelDescriptor {
  /**
   * The field to use to iterate over rows
   * in encryption/decryption/key rotation migrations.
   *
   * See https://github.com/47ng/prisma-field-encryption#migrations
   */
  cursor?: string
  fields: Record<string, FieldConfiguration> // key: field name
  connections: Record<string, ConnectionDescriptor> // key: field name
}

export type DMMFModels = Record<string, DMMFModelDescriptor> // key: model name

const supportedCursorTypes = ['Int', 'String']

export function analyseDMMF(input: DMMFDocument): DMMFModels {
  const dmmf = dmmfDocumentParser.parse(input)
  const allModels = dmmf.datamodel.models

  return allModels.reduce<DMMFModels>((output, model) => {
    const idField = model.fields.find(
      field => field.isId && supportedCursorTypes.includes(String(field.type))
    )
    const uniqueField = model.fields.find(
      field =>
        field.isUnique && supportedCursorTypes.includes(String(field.type))
    )
    const cursorField = model.fields.find(field =>
      field.documentation?.includes('@encryption:cursor')
    )
    if (cursorField) {
      // Make sure custom cursor field is valid
      if (!cursorField.isUnique) {
        throw new Error(errors.nonUniqueCursor(model.name, cursorField.name))
      }
      if (!supportedCursorTypes.includes(String(cursorField.type))) {
        throw new Error(
          errors.unsupportedCursorType(
            model.name,
            cursorField.name,
            String(cursorField.type)
          )
        )
      }
      if (cursorField.documentation?.includes('@encrypted')) {
        throw new Error(errors.encryptedCursor(model.name, cursorField.name))
      }
    }

    const modelDescriptor: DMMFModelDescriptor = {
      cursor: cursorField?.name ?? idField?.name ?? uniqueField?.name,
      fields: model.fields.reduce<DMMFModelDescriptor['fields']>(
        (fields, field) => {
          const fieldConfig = parseAnnotation(
            field.documentation,
            model.name,
            field.name
          )
          if (fieldConfig && field.type !== 'String') {
            throw new Error(errors.unsupportedFieldType(model, field))
          }
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
    if (
      Object.keys(modelDescriptor.fields).length > 0 &&
      !modelDescriptor.cursor
    ) {
      console.warn(warnings.noCursorFound(model.name))
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
  const strict = query.get('strict') !== null
  const readonly = query.get('readonly') !== null
  if (strict && process.env.NODE_ENV === 'development' && model && field) {
    console.warn(warnings.deprecatedModeAnnotation(model, field, 'strict'))
  }
  if (readonly && process.env.NODE_ENV === 'development' && model && field) {
    console.warn(warnings.deprecatedModeAnnotation(model, field, 'readonly'))
  }
  const mode =
    query.get('mode') ?? (readonly ? 'readonly' : strict ? 'strict' : 'default')
  /* istanbul ignore next */
  if (!['default', 'strict', 'readonly'].includes(mode)) {
    if (process.env.NODE_ENV === 'development' && model && field) {
      console.warn(warnings.unknownFieldModeAnnotation(model, field, mode))
    }
  }
  return {
    encrypt: mode !== 'readonly',
    strictDecryption: mode === 'strict'
  }
}
