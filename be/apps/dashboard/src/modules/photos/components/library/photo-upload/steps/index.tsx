import { usePhotoUploadStore } from '../store'
import type { WorkflowPhase } from '../types'
import { CompletedStep } from './CompletedStep'
import { ErrorStep } from './ErrorStep'
import { ProcessingStep } from './ProcessingStep'
import { ReviewStep } from './ReviewStep'
import { UploadingStep } from './UploadingStep'

const STEP_COMPONENTS: Record<WorkflowPhase, () => React.JSX.Element> = {
  review: ReviewStep,
  uploading: UploadingStep,
  processing: ProcessingStep,
  completed: CompletedStep,
  error: ErrorStep,
}

export function PhotoUploadSteps() {
  const phase = usePhotoUploadStore((state) => state.phase)
  const StepComponent = STEP_COMPONENTS[phase] ?? ReviewStep
  return <StepComponent />
}
