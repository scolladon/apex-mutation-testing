import { DryRunMutant } from '../type/DryRunMutant.js'

export class DryRunReporter {
  public countByMutator(mutants: DryRunMutant[]): Map<string, number> {
    const counts = new Map<string, number>()
    for (const mutant of mutants) {
      counts.set(mutant.mutatorName, (counts.get(mutant.mutatorName) ?? 0) + 1)
    }
    return new Map([...counts.entries()].sort((a, b) => b[1] - a[1]))
  }
}
