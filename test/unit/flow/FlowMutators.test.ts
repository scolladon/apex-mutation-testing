import { describe, expect, it } from 'vitest'
import {
  AssignmentMutator,
  ConnectorBypassMutator,
  DecisionOperatorMutator,
  FormulaExpressionMutator,
  getDefaultFlowMutators,
  RecordTriggerTypeMutator,
} from '../../../src/flow/mutators/index.js'
import { FlowXmlDom, SF_NAMESPACE } from '../../../src/flow/xml/FlowXmlDom.js'

const SAMPLE_FLOW_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="${SF_NAMESPACE}">
    <apiVersion>67.0</apiVersion>
    <areMetricsLoggedToDataCloud>false</areMetricsLoggedToDataCloud>
    <description>Presentation</description>
    <environments>Default</environments>
    <formulas>
        <description>Maps Task Priority picklist values with Account Rating picklist values</description>
        <name>TaskPriorityByAccountRating</name>
        <dataType>String</dataType>
        <expression>CASE(
    {!$Record.Rating},
    &apos;Hot&apos;, &apos;High&apos;,
    &apos;Warm&apos;, &apos;Normal&apos;,
    &apos;Cold&apos;, &apos;Low&apos;,
    &apos;Low&apos;
)</expression>
    </formulas>
    <interviewLabel>Account After {!$Flow.CurrentDateTime}</interviewLabel>
    <label>Account After</label>
    <processType>AutoLaunchedFlow</processType>
    <recordCreates>
        <name>Create_KRS_check_Tasks</name>
        <label>Create KRS check Tasks</label>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <inputReference>Prepare_KRS_check_Task.krsTask</inputReference>
    </recordCreates>
    <start>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <connector>
            <targetReference>Prepare_KRS_check_Task</targetReference>
        </connector>
        <object>Account</object>
        <recordTriggerType>Create</recordTriggerType>
        <triggerType>RecordAfterSave</triggerType>
    </start>
    <status>Draft</status>
    <subflows>
        <name>Prepare_KRS_check_Task</name>
        <label>Prepare KRS check Task</label>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <connector>
            <targetReference>Create_KRS_check_Tasks</targetReference>
        </connector>
        <flowName>Prepare_KRS_Task</flowName>
        <storeOutputAutomatically>true</storeOutputAutomatically>
    </subflows>
</Flow>`

describe('Flow XML Mutators', () => {
  it('RecordTriggerTypeMutator changes Create to Update while preserving valid XML', () => {
    const mutator = new RecordTriggerTypeMutator()
    const mutants = mutator.mutate(SAMPLE_FLOW_XML)

    expect(mutants).toHaveLength(1)
    expect(mutants[0].elementName).toBe('$Start')
    expect(mutants[0].mutatedSnippet).toBe(
      '<recordTriggerType>Update</recordTriggerType>'
    )

    const parsedMutant = FlowXmlDom.parse(mutants[0].mutatedXml)
    expect(parsedMutant.getText('//sf:start/sf:recordTriggerType')).toBe(
      'Update'
    )
    expect(parsedMutant.getText('//sf:apiVersion')).toBe('67.0')
  })

  it('RecordTriggerTypeMutator handles Update and CreateAndUpdate', () => {
    const mutator = new RecordTriggerTypeMutator()

    const xmlUpdate = SAMPLE_FLOW_XML.replace(
      '<recordTriggerType>Create</recordTriggerType>',
      '<recordTriggerType>Update</recordTriggerType>'
    )
    const mutantsUpdate = mutator.mutate(xmlUpdate)
    expect(mutantsUpdate).toHaveLength(1)
    expect(mutantsUpdate[0].mutatedSnippet).toBe(
      '<recordTriggerType>Create</recordTriggerType>'
    )

    const xmlCreateAndUpdate = SAMPLE_FLOW_XML.replace(
      '<recordTriggerType>Create</recordTriggerType>',
      '<recordTriggerType>CreateAndUpdate</recordTriggerType>'
    )
    const mutantsCreateAndUpdate = mutator.mutate(xmlCreateAndUpdate)
    expect(mutantsCreateAndUpdate).toHaveLength(2)
    expect(mutantsCreateAndUpdate[0].mutatedSnippet).toBe(
      '<recordTriggerType>Create</recordTriggerType>'
    )
    expect(mutantsCreateAndUpdate[1].mutatedSnippet).toBe(
      '<recordTriggerType>Update</recordTriggerType>'
    )
  })

  it('RecordTriggerTypeMutator returns empty if no recordTriggerType node', () => {
    const mutator = new RecordTriggerTypeMutator()
    const xml = `<Flow xmlns="${SF_NAMESPACE}"><start></start></Flow>`
    expect(mutator.mutate(xml)).toHaveLength(0)
  })

  it('FormulaExpressionMutator generates mutants for each string literal in CASE expression', () => {
    const mutator = new FormulaExpressionMutator()
    const mutants = mutator.mutate(SAMPLE_FLOW_XML)

    // 7 string literals in CASE: 'Hot', 'High', 'Warm', 'Normal', 'Cold', 'Low', 'Low'
    expect(mutants).toHaveLength(7)
    expect(mutants[0].elementName).toBe('TaskPriorityByAccountRating')
    expect(mutants[0].originalSnippet).toBe("'Hot'")
    expect(mutants[0].mutatedSnippet).toBe("''")
  })

  it('FormulaExpressionMutator mutates binary logical and comparison operators', () => {
    const mutator = new FormulaExpressionMutator()
    const xml = `<Flow xmlns="${SF_NAMESPACE}">
      <formulas>
        <name>ComplexFormula</name>
        <expression>{!varA} == {!varB} &amp;&amp; {!varC} != {!varD}</expression>
      </formulas>
    </Flow>`

    const mutants = mutator.mutate(xml)
    const opMutants = mutants.filter(m => m.originalSnippet !== "''")
    expect(opMutants.length).toBeGreaterThanOrEqual(3) // ==, &&, !=
    expect(
      opMutants.some(
        m => m.originalSnippet === '==' && m.mutatedSnippet === '!='
      )
    ).toBe(true)
    expect(
      opMutants.some(
        m => m.originalSnippet === '&&' && m.mutatedSnippet === '||'
      )
    ).toBe(true)
    expect(
      opMutants.some(
        m => m.originalSnippet === '!=' && m.mutatedSnippet === '=='
      )
    ).toBe(true)
  })

  it('FormulaExpressionMutator mutates all occurrences of binary operators individually', () => {
    const mutator = new FormulaExpressionMutator()
    const xml = `<Flow xmlns="${SF_NAMESPACE}">
      <formulas>
        <name>MultipleOpsFormula</name>
        <expression>{!varA} == {!varB} &amp;&amp; {!varC} == {!varD}</expression>
      </formulas>
    </Flow>`

    const mutants = mutator.mutate(xml)
    const eqMutants = mutants.filter(
      m => m.originalSnippet === '==' && m.mutatedSnippet === '!='
    )
    expect(eqMutants).toHaveLength(2)

    // Verify first mutant replaced only the first '=='
    expect(eqMutants[0].mutatedXml).toContain(
      '{!varA} != {!varB} &amp;&amp; {!varC} == {!varD}'
    )
    // Verify second mutant replaced only the second '=='
    expect(eqMutants[1].mutatedXml).toContain(
      '{!varA} == {!varB} &amp;&amp; {!varC} != {!varD}'
    )
  })

  it('ConnectorBypassMutator bypasses Prepare_KRS_check_Task subflow directly to Create_KRS_check_Tasks', () => {
    const mutator = new ConnectorBypassMutator()
    const mutants = mutator.mutate(SAMPLE_FLOW_XML)

    expect(mutants).toHaveLength(1)
    expect(mutants[0].elementName).toBe('Prepare_KRS_check_Task')

    const parsedMutant = FlowXmlDom.parse(mutants[0].mutatedXml)
    // Start connector should now point directly to Create_KRS_check_Tasks
    expect(
      parsedMutant.getText('//sf:start/sf:connector/sf:targetReference')
    ).toBe('Create_KRS_check_Tasks')
  })

  it('DecisionOperatorMutator inverts decision condition operators', () => {
    const xml = `<Flow xmlns="${SF_NAMESPACE}">
      <decisions>
        <name>Check_Rating</name>
        <label>Check Rating</label>
        <rules>
          <name>Rating_Is_Hot</name>
          <conditions>
            <leftValueReference>$Record.Rating</leftValueReference>
            <operator>EqualTo</operator>
            <rightValue><stringValue>Hot</stringValue></rightValue>
          </conditions>
          <conditions>
            <leftValueReference>$Record.NumberOfEmployees</leftValueReference>
            <operator>GreaterThan</operator>
            <rightValue><numberValue>100</numberValue></rightValue>
          </conditions>
        </rules>
      </decisions>
    </Flow>`

    const mutator = new DecisionOperatorMutator()
    const mutants = mutator.mutate(xml)

    expect(mutants).toHaveLength(2)
    expect(mutants[0].elementName).toBe('Check_Rating')
    expect(mutants[0].originalSnippet).toBe('<operator>EqualTo</operator>')
    expect(mutants[0].mutatedSnippet).toBe('<operator>NotEqualTo</operator>')

    expect(mutants[1].originalSnippet).toBe('<operator>GreaterThan</operator>')
    expect(mutants[1].mutatedSnippet).toBe(
      '<operator>LessThanOrEqualTo</operator>'
    )
  })

  it('ConnectorBypassMutator skips elements without outgoing connector or incoming refs', () => {
    const mutator = new ConnectorBypassMutator()
    const xml = `<Flow xmlns="${SF_NAMESPACE}">
      <recordCreates>
        <name>OnlyTargetNoConnector</name>
      </recordCreates>
      <recordUpdates>
        <name>NoIncomingRef</name>
        <connector><targetReference>Somewhere</targetReference></connector>
      </recordUpdates>
    </Flow>`
    expect(mutator.mutate(xml)).toHaveLength(0)
  })

  it('DecisionOperatorMutator skips decisions without condition operators or unmapped operators', () => {
    const mutator = new DecisionOperatorMutator()
    const xml = `<Flow xmlns="${SF_NAMESPACE}">
      <decisions>
        <name>Dec</name>
        <rules>
          <conditions>
            <operator>CustomUnsupportedOperator</operator>
          </conditions>
        </rules>
      </decisions>
    </Flow>`
    expect(mutator.mutate(xml)).toHaveLength(0)
  })

  it('FormulaExpressionMutator skips formulas without expression or with no matches', () => {
    const mutator = new FormulaExpressionMutator()
    const xml = `<Flow xmlns="${SF_NAMESPACE}">
      <formulas>
        <name>EmptyFormula</name>
      </formulas>
      <formulas>
        <name>NoMatchFormula</name>
        <expression>12345</expression>
      </formulas>
    </Flow>`
    expect(mutator.mutate(xml)).toHaveLength(0)
  })

  it('DecisionOperatorMutator handles unnamed decisions and empty operator text', () => {
    const mutator = new DecisionOperatorMutator()
    const xml = `<Flow xmlns="${SF_NAMESPACE}">
      <decisions>
        <rules>
          <conditions>
            <operator>EqualTo</operator>
          </conditions>
          <conditions>
            <operator></operator>
          </conditions>
        </rules>
      </decisions>
    </Flow>`
    const mutants = mutator.mutate(xml)
    expect(mutants).toHaveLength(1)
    expect(mutants[0].elementName).toBe('Decision_0')
  })

  it('FormulaExpressionMutator handles unnamed formulas', () => {
    const mutator = new FormulaExpressionMutator()
    const xml = `<Flow xmlns="${SF_NAMESPACE}">
      <formulas>
        <expression>'Hello'</expression>
      </formulas>
    </Flow>`
    const mutants = mutator.mutate(xml)
    expect(mutants).toHaveLength(1)
    expect(mutants[0].elementName).toBe('Formula_0')
  })

  it('RecordTriggerTypeMutator handles empty recordTriggerType text', () => {
    const mutator = new RecordTriggerTypeMutator()
    const xml = `<Flow xmlns="${SF_NAMESPACE}">
      <start>
        <recordTriggerType></recordTriggerType>
      </start>
    </Flow>`
    expect(mutator.mutate(xml)).toHaveLength(0)
  })

  it('RecordTriggerTypeMutator returns empty on unsupported trigger type', () => {
    const mutator = new RecordTriggerTypeMutator()
    const xml = `<Flow xmlns="${SF_NAMESPACE}"><start><recordTriggerType>Delete</recordTriggerType></start></Flow>`
    expect(mutator.mutate(xml)).toHaveLength(0)
  })

  it('DecisionOperatorMutator inverts boolean conditions such as IsBlank or IsNull', () => {
    const mutator = new DecisionOperatorMutator()
    const xml = `<Flow xmlns="${SF_NAMESPACE}">
      <decisions>
        <name>Check_Website</name>
        <rules>
          <name>Is_Empty</name>
          <conditions>
            <leftValueReference>recordId.Website</leftValueReference>
            <operator>IsBlank</operator>
            <rightValue>
              <booleanValue>true</booleanValue>
            </rightValue>
          </conditions>
        </rules>
      </decisions>
    </Flow>`
    const mutants = mutator.mutate(xml)
    expect(mutants).toHaveLength(1)
    expect(mutants[0].description).toContain("from 'true' to 'false'")
    expect(mutants[0].mutatedSnippet).toBe('<booleanValue>false</booleanValue>')
  })

  it('ConnectorBypassMutator bypasses terminal nodes in rules by removing connector', () => {
    const mutator = new ConnectorBypassMutator()
    const xml = `<Flow xmlns="${SF_NAMESPACE}">
      <assignments>
        <name>Assign_End</name>
      </assignments>
      <decisions>
        <name>Decision1</name>
        <rules>
          <name>Rule1</name>
          <connector>
            <targetReference>Assign_End</targetReference>
          </connector>
        </rules>
      </decisions>
    </Flow>`
    const mutants = mutator.mutate(xml)
    expect(mutants).toHaveLength(1)
    expect(mutants[0].description).toContain(
      'Bypassed terminal assignments element'
    )
    expect(mutants[0].mutatedXml).not.toContain(
      '<targetReference>Assign_End</targetReference>'
    )
  })

  it('AssignmentMutator mutates string, boolean, number and operator assignments', () => {
    const mutator = new AssignmentMutator()
    const xml = `<Flow xmlns="${SF_NAMESPACE}">
      <assignments>
        <name>Assign_Values</name>
        <assignmentItems>
          <assignToReference>recordId.Website</assignToReference>
          <operator>Assign</operator>
          <value>
            <stringValue>www.salesforce.com</stringValue>
          </value>
        </assignmentItems>
        <assignmentItems>
          <assignToReference>recordId.IsActive</assignToReference>
          <operator>Assign</operator>
          <value>
            <booleanValue>true</booleanValue>
          </value>
        </assignmentItems>
        <assignmentItems>
          <assignToReference>Counter</assignToReference>
          <operator>Add</operator>
          <value>
            <numberValue>5.0</numberValue>
          </value>
        </assignmentItems>
      </assignments>
    </Flow>`
    const mutants = mutator.mutate(xml)
    // 1 string mutation, 1 boolean mutation, 1 number mutation, 1 Add->Subtract mutation
    expect(mutants).toHaveLength(4)
    expect(
      mutants.some(m => m.mutatedSnippet === '<stringValue></stringValue>')
    ).toBe(true)
    expect(
      mutants.some(
        m => m.mutatedSnippet === '<booleanValue>false</booleanValue>'
      )
    ).toBe(true)
    expect(
      mutants.some(m => m.mutatedSnippet === '<numberValue>0.0</numberValue>')
    ).toBe(true)
    expect(
      mutants.some(m => m.mutatedSnippet === '<operator>Subtract</operator>')
    ).toBe(true)
  })

  it('AssignmentMutator handles empty string, false boolean, zero/NaN number, Subtract operator, and unnamed elements', () => {
    const mutator = new AssignmentMutator()
    const xml = `<Flow xmlns="${SF_NAMESPACE}">
      <assignments>
        <assignmentItems>
          <value>
            <stringValue></stringValue>
          </value>
        </assignmentItems>
        <assignmentItems>
          <operator>Subtract</operator>
          <value>
            <booleanValue>false</booleanValue>
          </value>
        </assignmentItems>
        <assignmentItems>
          <value>
            <numberValue>   </numberValue>
          </value>
        </assignmentItems>
        <assignmentItems>
          <value>
            <numberValue>0</numberValue>
          </value>
        </assignmentItems>
        <assignmentItems>
          <value>
            <numberValue>notanumber</numberValue>
          </value>
        </assignmentItems>
        <assignmentItems>
          <value>
            <booleanValue>notabool</booleanValue>
          </value>
        </assignmentItems>
      </assignments>
    </Flow>`
    const mutants = mutator.mutate(xml)
    expect(mutants.length).toBeGreaterThanOrEqual(4)
    expect(mutants[0].elementName).toBe('Assignment_0')
    expect(
      mutants.some(
        m => m.mutatedSnippet === '<stringValue>MUTATED</stringValue>'
      )
    ).toBe(true)
    expect(
      mutants.some(
        m => m.mutatedSnippet === '<booleanValue>true</booleanValue>'
      )
    ).toBe(true)
    expect(
      mutants.some(m => m.mutatedSnippet === '<numberValue>1.0</numberValue>')
    ).toBe(true)
    expect(
      mutants.some(m => m.mutatedSnippet === '<operator>Add</operator>')
    ).toBe(true)
  })

  it('ConnectorBypassMutator handles nodes without name and terminal nodes in rules without name', () => {
    const mutator = new ConnectorBypassMutator()
    const xml = `<Flow xmlns="${SF_NAMESPACE}">
      <recordCreates>
        <label>MissingName</label>
      </recordCreates>
      <assignments>
        <name>Terminal_Assign</name>
      </assignments>
      <decisions>
        <name>Dec</name>
        <rules>
          <connector>
            <targetReference>Terminal_Assign</targetReference>
          </connector>
        </rules>
      </decisions>
    </Flow>`
    const mutants = mutator.mutate(xml)
    expect(mutants).toHaveLength(1)
    expect(mutants[0].description).toContain("rule 'Rule'")
  })

  it('DecisionOperatorMutator handles false boolean condition, missing leftValueReference, and missing operator', () => {
    const mutator = new DecisionOperatorMutator()
    const xml = `<Flow xmlns="${SF_NAMESPACE}">
      <decisions>
        <name>Dec</name>
        <rules>
          <name>Rule1</name>
          <conditions>
            <rightValue>
              <booleanValue>false</booleanValue>
            </rightValue>
          </conditions>
          <conditions>
            <rightValue>
              <booleanValue>invalid_bool</booleanValue>
            </rightValue>
          </conditions>
        </rules>
      </decisions>
    </Flow>`
    const mutants = mutator.mutate(xml)
    expect(mutants).toHaveLength(1)
    expect(mutants[0].mutatedSnippet).toBe('<booleanValue>true</booleanValue>')
    expect(mutants[0].description).toContain(
      "condition 'condition ' from 'false' to 'true'"
    )
  })

  it('FormulaExpressionMutator mutates multiline formula expressions and OR operators', () => {
    const mutator = new FormulaExpressionMutator()
    const xml = `<Flow xmlns="${SF_NAMESPACE}">
      <formulas>
        <name>MultilineFormula</name>
        <expression>{!varA} ||
'First' == {!varB}</expression>
      </formulas>
    </Flow>`
    const mutants = mutator.mutate(xml)
    expect(mutants.length).toBeGreaterThanOrEqual(3)
    expect(
      mutants.some(m => m.originalSnippet === '||' && m.mutatedSnippet === '&&')
    ).toBe(true)
    expect(mutants.some(m => m.originalSnippet === "'First'")).toBe(true)
  })

  it('getDefaultFlowMutators returns 5 registered mutators', () => {
    const mutators = getDefaultFlowMutators()
    expect(mutators).toHaveLength(5)
    expect(mutators.map(m => m.name)).toEqual([
      'RecordTriggerTypeMutator',
      'FormulaExpressionMutator',
      'ConnectorBypassMutator',
      'DecisionOperatorMutator',
      'AssignmentMutator',
    ])
  })
})
