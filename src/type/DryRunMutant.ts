export interface DryRunMutant {
  line: number
  mutatorName: string
  original: string
  replacement: string
}
