import type { Debugger } from 'debug'
import { debug } from './debugger'
import { DMMFModels } from './dmmf'
import { Item, traverseTree } from './traverseTree'
import type { FieldConfiguration, MiddlewareParams } from './types'

interface VisitorState {
  currentModel: string
}

export interface TargetField {
  path: string
  value: string
  model: string
  field: string
  fieldConfig: FieldConfiguration
}

export type TargetFieldVisitorFn = (targetField: TargetField) => void

const makeVisitor = (
  models: DMMFModels,
  visitor: TargetFieldVisitorFn,
  specialSubFields: string[],
  debug: Debugger
) =>
  function visitNode(state: VisitorState, { key, type, node, path }: Item) {
    const model = models[state.currentModel]
    if (!model || !key) {
      return state
    }
    if (type === 'string' && key in model.fields) {
      const targetField: TargetField = {
        field: key,
        model: state.currentModel,
        fieldConfig: model.fields[key],
        path: path.join('.'),
        value: node as string
      }
      debug('Visiting %O', targetField)
      visitor(targetField)
      return state
    }
    // Special cases: {field}.set for updates, {field}.equals for queries
    for (const specialSubField of specialSubFields) {
      if (
        type === 'object' &&
        key in model.fields &&
        typeof (node as any)?.[specialSubField] === 'string'
      ) {
        const value: string = (node as any)[specialSubField]
        const targetField: TargetField = {
          field: key,
          model: state.currentModel,
          fieldConfig: model.fields[key],
          path: [...path, specialSubField].join('.'),
          value
        }
        debug('Visiting %O', targetField)
        visitor(targetField)
        return state
      }
    }
    if (['object', 'array'].includes(type) && key in model.connections) {
      // Follow the connection: from there on downwards, we're changing models.
      // Return a new object to break from existing references.
      debug(
        `Changing model: following connection ${state.currentModel}.${key} to model ${model.connections[key].modelName}`
      )
      return {
        currentModel: model.connections[key].modelName
      }
    }
    return state
  }

export function visitInputTargetFields<
  Models extends string,
  Actions extends string
>(
  params: MiddlewareParams<Models, Actions>,
  models: DMMFModels,
  visitor: TargetFieldVisitorFn
) {
  traverseTree(
    params.args,
    makeVisitor(models, visitor, ['equals', 'set'], debug.encryption),
    {
      currentModel: params.model!
    }
  )
}

export function visitOutputTargetFields<
  Models extends string,
  Actions extends string
>(
  params: MiddlewareParams<Models, Actions>,
  result: any,
  models: DMMFModels,
  visitor: TargetFieldVisitorFn
) {
  traverseTree(result, makeVisitor(models, visitor, [], debug.decryption), {
    currentModel: params.model!
  })
}
