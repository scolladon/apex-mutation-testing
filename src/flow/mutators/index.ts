import type { FlowMutator } from '../types.js'
import { AssignmentMutator } from './AssignmentMutator.js'
import { ConnectorBypassMutator } from './ConnectorBypassMutator.js'
import { DecisionOperatorMutator } from './DecisionOperatorMutator.js'
import { FormulaExpressionMutator } from './FormulaExpressionMutator.js'
import { RecordTriggerTypeMutator } from './RecordTriggerTypeMutator.js'

export {
  AssignmentMutator,
  ConnectorBypassMutator,
  DecisionOperatorMutator,
  FormulaExpressionMutator,
  RecordTriggerTypeMutator,
}

export function getDefaultFlowMutators(): FlowMutator[] {
  return [
    new RecordTriggerTypeMutator(),
    new FormulaExpressionMutator(),
    new ConnectorBypassMutator(),
    new DecisionOperatorMutator(),
    new AssignmentMutator(),
  ]
}
