import { describe, expect, it } from 'vitest'
import { buildStoryResponseSchema } from '@/utils/providerConfigUtils'

type SchemaNode = Record<string, any>

const contextOf = (path: string[]) => {
  return `(${path.map((part) => `'${part}'`).join(', ')})`
}

const additionalPropertiesError = (path: string[]) => {
  return `Invalid schema for response_format 'StoryResponse': In context=${contextOf(path)}, 'additionalProperties' is required to be supplied and to be false.`
}

const requiredError = (path: string[], detail: string) => {
  return `Invalid schema for response_format 'StoryResponse': In context=${contextOf(path)}, 'required' is required to be supplied and to be an array including every key in properties. ${detail}`
}

const firstStrictProblem = (node: SchemaNode, path: string[], isRoot: boolean): string | null => {
  if (!node || typeof node !== 'object') return null

  if (Array.isArray(node.anyOf)) {
    for (let index = 0; index < node.anyOf.length; index += 1) {
      const problem = firstStrictProblem(node.anyOf[index], [...path, 'anyOf', String(index)], false)
      if (problem) return problem
    }

    return null
  }

  if (node.type === 'array') {
    if (!node.items) return null

    return firstStrictProblem(node.items, [...path, 'items'], false)
  }

  if (node.type !== 'object') return null

  const hasAdditionalProperties = Object.prototype.hasOwnProperty.call(node, 'additionalProperties')
  const additionalProperties = node.additionalProperties
  if (!isRoot && (!hasAdditionalProperties || additionalProperties === true)) {
    return additionalPropertiesError(path)
  }

  const properties = node.properties
  if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
    for (const key of Object.keys(properties)) {
      const problem = firstStrictProblem(properties[key], [...path, 'properties', key], false)
      if (problem) return problem
    }
  }

  if (hasAdditionalProperties && additionalProperties && typeof additionalProperties === 'object') {
    const problem = firstStrictProblem(additionalProperties, [...path, 'additionalProperties'], false)
    if (problem) return problem
  }

  if (!isRoot && (!properties || typeof properties !== 'object' || Array.isArray(properties))) {
    return requiredError(path, 'Missing \'properties\'.')
  }

  if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
    const keys = Object.keys(properties)
    const required = Array.isArray(node.required) ? node.required : null
    if (!required) {
      return requiredError(path, keys.length ? `Missing '${keys[0]}'.` : 'Missing \'required\'.')
    }

    const missing = keys.filter((key) => !required.includes(key))
    if (missing.length) {
      return requiredError(path, `Missing '${missing[0]}'.`)
    }

    const extra = required.filter((key: string) => !Object.prototype.hasOwnProperty.call(properties, key))
    if (extra.length) {
      return requiredError(path, `Extra required key '${extra[0]}' supplied.`)
    }
  }

  return null
}

const strictSchemaError = (responseFormat: { json_schema: { schema: SchemaNode } }) => {
  return firstStrictProblem(responseFormat.json_schema.schema, [], true)
}

describe('buildStoryResponseSchema', () => {
  it('builds a StoryResponse schema OpenAI strict mode accepts', () => {
    const cases = [
      [false, false],
      [true, false],
      [false, true],
      [true, true]
    ] as const

    for (const [isGameMode, includeAnimReason] of cases) {
      const sent = JSON.parse(JSON.stringify(buildStoryResponseSchema(isGameMode, includeAnimReason)))
      expect(sent.json_schema.name).toBe('StoryResponse')
      expect(strictSchemaError(sent)).toBeNull()
    }
  })
})
