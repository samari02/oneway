import { useCallback } from 'react'
import {
  createBoundary,
  updateBoundary,
  deleteBoundary,
  toggleBoundary,
  type CreateBoundaryData,
  type UpdateBoundaryData,
} from '../api/boundaries'
import type { Boundary } from '@oneway/shared'

interface UseBoundaryActionsResult {
  create: (data: CreateBoundaryData) => Promise<Boundary>
  update: (id: string, data: UpdateBoundaryData) => Promise<Boundary>
  remove: (id: string) => Promise<void>
  toggle: (id: string, isActive: boolean) => Promise<Boundary>
}

export function useBoundaryActions(): UseBoundaryActionsResult {
  const create = useCallback(async (data: CreateBoundaryData) => {
    return createBoundary(data)
  }, [])

  const update = useCallback(async (id: string, data: UpdateBoundaryData) => {
    return updateBoundary(id, data)
  }, [])

  const remove = useCallback(async (id: string) => {
    return deleteBoundary(id)
  }, [])

  const toggle = useCallback(async (id: string, isActive: boolean) => {
    return toggleBoundary(id, isActive)
  }, [])

  return { create, update, remove, toggle }
}
