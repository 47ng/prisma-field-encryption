// @ts-ignore
import { Prisma } from '@prisma/client'
import type { FieldsConfiguration } from './types'

interface DMMFModel {
  name: string
  fields: DMMFField[]
}

interface DMMFField {
  name: string
  documentation?: string
}

export function configureFields(): FieldsConfiguration {
  return Object.fromEntries(
    Prisma.dmmf.datamodel.models.flatMap((model: DMMFModel) =>
      model.fields
        .filter(field => field.documentation?.includes('@encrypted'))
        .map(field => [[model.name, field.name].join('.'), true])
    )
  )
}
