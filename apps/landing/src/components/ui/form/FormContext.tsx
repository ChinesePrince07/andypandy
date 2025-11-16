import type { PrimitiveAtom } from 'jotai'
import { createContext, use } from 'react'

import type { Field } from './types'

export const FormContext = createContext<{
  fields: PrimitiveAtom<Record<string, Field>>

  addField: (name: string, field: Field) => void
  removeField: (name: string) => void
  getField: (name: string) => Field | undefined
}>(null!)

export const FormConfigContext = createContext<{
  showErrorMessage?: boolean
}>(null!)
export const useForm = () => {
  return use(FormContext)
}
export const useFormConfig = () => use(FormConfigContext)
