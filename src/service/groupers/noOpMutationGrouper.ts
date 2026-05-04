import {
  GrouperInput,
  MutationGroup,
  MutationGrouper,
  testsForMutation,
} from '../mutationGrouper.js'

/**
 * Baseline strategy: one mutation per group. Preserves the current
 * one-deploy-one-test-run behaviour. Useful as a fallback and as a control
 * when measuring savings from smarter strategies.
 */
export class NoOpMutationGrouper implements MutationGrouper {
  public group(input: GrouperInput): MutationGroup[] {
    return input.mutations.map(mutation => ({
      mutations: [mutation],
      testMethods: new Set(
        testsForMutation(mutation, input.testMethodsPerLine)
      ),
    }))
  }
}
