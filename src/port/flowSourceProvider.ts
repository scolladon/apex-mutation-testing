// One FlowTest as the org stores it: its metadata fullName — the name a
// retrieve or a deploy addresses it by — and its XML, verbatim.
export interface FlowTestSource {
  fullName: string
  xml: string
}

// The Flow under mutation, read from the org rather than from the local
// project: the org is the state a run starts from and must return to, exactly
// as the Apex engine reads the class body it mutates from the org.
export interface FlowSource {
  apiName: string
  // The XML of the flow's latest version — the version a Metadata API
  // retrieve returns, and the one every deploy of this run overwrites or
  // supersedes.
  xml: string
  tests: FlowTestSource[]
}

export interface FlowSourceProvider {
  // testNames narrows the FlowTests read to the given ones; omitted, every
  // FlowTest of the flow is read. Never writes to the org.
  readFlow(apiName: string, testNames?: string[]): Promise<FlowSource>
}
