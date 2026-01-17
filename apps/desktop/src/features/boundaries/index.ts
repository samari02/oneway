// Components
export { BoundariesView } from './components/BoundariesView'
export { AddBoundaryModal } from './components/AddBoundaryModal'
export { EditBoundaryModal } from './components/EditBoundaryModal'
export { ProtectionAlert } from './components/ProtectionAlert'
export { IncognitoSetupModal } from './components/IncognitoSetupModal'

// Hooks
export { useBoundaries } from './hooks/useBoundaries'
export { useBoundaryActions } from './hooks/useBoundaryActions'
export { useExtensionStatus, type ExtensionStatus, type AlertLevel } from './hooks/useExtensionStatus'

// API
export * from './api/boundaries'
