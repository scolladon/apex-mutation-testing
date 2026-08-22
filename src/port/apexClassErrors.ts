// The typed rejections for TargetClassVerdict, colocated with the verdict
// they refuse: assessTargetClass/readClass (the org adapter) and
// ApexClassValidator (the service) both need to throw and catch the same
// four types for the same conditions, so — like TargetClassVerdict itself —
// they belong on the port both sides already depend on, not on one
// concrete service. Re-exported from service/apexClassValidator.ts so
// existing importers there are unaffected.
export class ApexClassNotFoundError extends Error {
  constructor(public readonly className: string) {
    super(`Apex class '${className}' not found`)
    this.name = 'ApexClassNotFoundError'
  }
}

export class ApexClassNotMutableError extends Error {
  constructor(
    public readonly className: string,
    public readonly states: string[]
  ) {
    super(`Apex class '${className}' is not modifiable on this org`)
    this.name = 'ApexClassNotMutableError'
  }
}

export class ApexClassAmbiguousError extends Error {
  constructor(
    public readonly className: string,
    public readonly spellings: string[]
  ) {
    super(`Apex class '${className}' matches more than one modifiable class`)
    this.name = 'ApexClassAmbiguousError'
  }
}

// spelling is org-supplied (embeds NamespacePrefix) and deliberately kept off
// the super() message — see ApexClassNotMutableError/ApexClassAmbiguousError
// above, which keep their org-supplied lists on fields for the same reason:
// the raw .message is a terminal sink on the readClass/TOCTOU path, which
// bypasses run.ts's sanitizeForDisplay rendering.
export class ApexClassUnqualifiedError extends Error {
  constructor(
    public readonly className: string,
    public readonly spelling: string
  ) {
    super(`Apex class '${className}' is modifiable on this org only`)
    this.name = 'ApexClassUnqualifiedError'
  }
}
