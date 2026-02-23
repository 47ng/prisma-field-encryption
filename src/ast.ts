import fs from 'node:fs'
import path from 'node:path'
import { getSchema } from '@mrleebo/prisma-ast'
import type { ConnectionDescriptor, DMMFModelDescriptor, DMMFModels } from './dmmf'
import { parseEncryptedAnnotation, parseHashAnnotation } from './dmmf'
import { errors, warnings } from './errors'

interface ASTField {
  type: 'field'
  name: string
  fieldType: string
  array?: boolean
  optional?: boolean
  attributes?: Array<{
    type: 'attribute'
    name: string
    args?: any[]
    group?: string
  }>
  comment?: string
}

interface ASTModel {
  type: 'model'
  name: string
  properties: Array<ASTField | any>
}

const supportedCursorTypes = ['Int', 'String', 'BigInt']

/**
 * Extracts the documentation string from a field's triple-slash comment.
 * prisma-ast stores `/// @encrypted` as `field.comment = "/// @encrypted"`.
 * We strip the leading `///` and any leading whitespace.
 */
function extractDocumentation(comment?: string): string | undefined {
  if (!comment) return undefined
  // Handle triple-slash comments: "/// @encrypted" -> " @encrypted"
  const match = comment.match(/^\/\/\/\s?(.*)/)
  return match ? match[1] : undefined
}

/**
 * Check if a field has a specific attribute (e.g., @id, @unique).
 */
function hasAttribute(field: ASTField, attrName: string): boolean {
  return field.attributes?.some(attr => attr.name === attrName) ?? false
}

/**
 * Analyses a Prisma schema string directly using AST parsing,
 * returning the same DMMFModels structure as analyseDMMF.
 * This avoids dependency on Prisma's internal DMMF format.
 */
export function analyseSchema(schemaSource: string): DMMFModels {
  const schema = getSchema(schemaSource)

  // Extract all model blocks
  const allModels = schema.list.filter(
    (block): block is ASTModel => block.type === 'model'
  )

  // Extract all model names for connection resolution
  const modelNames = new Set(allModels.map(m => m.name))

  return allModels.reduce<DMMFModels>((output, model) => {
    // Filter to only field properties
    const fields = model.properties.filter(
      (prop): prop is ASTField => prop.type === 'field'
    )

    // Find cursor field
    const idField = fields.find(
      field =>
        hasAttribute(field, 'id') &&
        supportedCursorTypes.includes(String(field.fieldType))
    )
    const uniqueField = fields.find(
      field =>
        hasAttribute(field, 'unique') &&
        supportedCursorTypes.includes(String(field.fieldType))
    )
    const cursorField = fields.find(field => {
      const doc = extractDocumentation(field.comment)
      return doc?.includes('@encryption:cursor')
    })

    if (cursorField) {
      // Make sure custom cursor field is valid
      if (!hasAttribute(cursorField, 'unique')) {
        throw new Error(errors.nonUniqueCursor(model.name, cursorField.name))
      }
      if (!supportedCursorTypes.includes(String(cursorField.fieldType))) {
        throw new Error(
          errors.unsupportedCursorType(
            model.name,
            cursorField.name,
            String(cursorField.fieldType)
          )
        )
      }
      const cursorDoc = extractDocumentation(cursorField.comment)
      if (cursorDoc?.includes('@encrypted')) {
        throw new Error(errors.encryptedCursor(model.name, cursorField.name))
      }
    }

    const modelDescriptor: DMMFModelDescriptor = {
      cursor: cursorField?.name ?? idField?.name ?? uniqueField?.name,
      fields: fields.reduce<DMMFModelDescriptor['fields']>(
        (fieldMap, field) => {
          const doc = extractDocumentation(field.comment)
          const fieldConfig = parseEncryptedAnnotation(
            doc,
            model.name,
            field.name
          )
          if (fieldConfig && String(field.fieldType) !== 'String') {
            // Build a DMMFModel/DMMFField-compatible object for the error message
            throw new Error(
              errors.unsupportedFieldType(
                { name: model.name, fields: [] } as any,
                {
                  name: field.name,
                  type: field.fieldType,
                  isList: false,
                  isUnique: false,
                  isId: false
                } as any
              )
            )
          }
          return fieldConfig
            ? { ...fieldMap, [field.name]: fieldConfig }
            : fieldMap
        },
        {}
      ),
      connections: fields.reduce<DMMFModelDescriptor['connections']>(
        (connections, field) => {
          // A field is a connection if its type is the name of another model
          if (!modelNames.has(String(field.fieldType))) {
            return connections
          }
          const connection: ConnectionDescriptor = {
            modelName: String(field.fieldType),
            isList: field.array ?? false
          }
          return {
            ...connections,
            [field.name]: connection
          }
        },
        {}
      )
    }

    // Inject hash information
    fields.forEach(field => {
      const doc = extractDocumentation(field.comment)
      const hashConfig = parseHashAnnotation(doc, model.name, field.name)
      if (!hashConfig) {
        return
      }
      if (String(field.fieldType) !== 'String') {
        throw new Error(
          errors.unsupporteHashFieldType(
            { name: model.name, fields: [] } as any,
            {
              name: field.name,
              type: field.fieldType,
              isList: false,
              isUnique: false,
              isId: false
            } as any
          )
        )
      }
      const { sourceField, ...hash } = hashConfig
      if (!(sourceField in modelDescriptor.fields)) {
        throw new Error(
          errors.hashSourceFieldNotFound(
            { name: model.name, fields: [] } as any,
            {
              name: field.name,
              type: field.fieldType,
              isList: false,
              isUnique: false,
              isId: false
            } as any,
            sourceField
          )
        )
      }
      modelDescriptor.fields[hashConfig.sourceField].hash = hash
    })

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

/**
 * Recursively collects all `.prisma` files from a directory.
 */
function collectPrismaFiles(dirPath: string): string[] {
  const files: string[] = []
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      // Skip migrations and node_modules directories
      if (entry.name === 'migrations' || entry.name === 'node_modules') {
        continue
      }
      files.push(...collectPrismaFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.prisma')) {
      files.push(fullPath)
    }
  }
  return files
}

/**
 * Reads all .prisma files from a directory and concatenates them
 * into a single schema string. This supports Prisma's multi-file
 * schema feature (prismaSchemaFolder) available since Prisma 5.15.
 */
function readSchemaDirectory(dirPath: string): string {
  const prismaFiles = collectPrismaFiles(dirPath)
  if (prismaFiles.length === 0) {
    throw new Error(
      `[prisma-field-encryption] No .prisma files found in directory: ${dirPath}`
    )
  }
  // Sort for deterministic ordering
  prismaFiles.sort()

  return prismaFiles
    .map(filePath => fs.readFileSync(filePath, 'utf-8'))
    .join('\n\n')
}

/**
 * Analyses a Prisma schema from a file path or directory path.
 * If the path is a directory, all `.prisma` files within it
 * (including nested subdirectories) are read and merged,
 * supporting Prisma's multi-file schema feature.
 */
export function analyseSchemaFile(schemaPath: string): DMMFModels {
  const resolvedPath = path.resolve(schemaPath)
  const stat = fs.statSync(resolvedPath)

  let source: string
  if (stat.isDirectory()) {
    source = readSchemaDirectory(resolvedPath)
  } else {
    source = fs.readFileSync(resolvedPath, 'utf-8')
  }
  return analyseSchema(source)
}

/**
 * Attempts to find the Prisma schema file or directory by looking
 * at common locations. Supports both single-file and multi-file
 * schema setups.
 */
export function findSchemaPath(): string | undefined {
  const candidates = [
    // Single file locations
    path.resolve('prisma/schema.prisma'),
    path.resolve('schema.prisma'),
    // Multi-file schema directory (prismaSchemaFolder)
    path.resolve('prisma/schema'),
    // The prisma/ directory itself may contain multiple .prisma files
    path.resolve('prisma')
  ]
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue
    }
    const stat = fs.statSync(candidate)
    if (stat.isFile()) {
      return candidate
    }
    if (stat.isDirectory()) {
      // Only return a directory if it contains .prisma files
      const hasSchemaFiles = collectPrismaFiles(candidate).length > 0
      if (hasSchemaFiles) {
        return candidate
      }
    }
  }
  return undefined
}
