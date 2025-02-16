import fs from 'node:fs'
import path from 'node:path'
import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  CaseInsensitiveInputStream,
  CommonTokenStream,
  ParseTreeWalker,
} from 'apex-parser'

run()

function run() {
  const ROOT_OUTPUT_DIR = 'output'
  const outputDirForRunName = path.join(
    ROOT_OUTPUT_DIR,
    `run_at_${Math.floor(Date.now() / 1000)}`
  )

  if (!fs.existsSync(ROOT_OUTPUT_DIR)) {
    fs.mkdirSync(ROOT_OUTPUT_DIR)
  }
  fs.mkdirSync(outputDirForRunName)

  //  const inputFileStream = fs.readFileSync(inputFileName, 'utf8');
  const lexer = new ApexLexer(
    new CaseInsensitiveInputStream(
      'other',
      "public class Hello {public void MyMethod(){Integer i = 0; i++; --i; if(i == 12) {System.Debug('test');}}}"
    )
  )
  const tokenStream = new CommonTokenStream(lexer)
  const parser = new ApexParser(tokenStream)
  const tree = parser.compilationUnit()

  /*
  const outputFilePath = path.join(outputDirForRunName, 'output.txt');
  const debugFilePath = path.join(outputDirForRunName, 'debug.txt');
  const outputFile = fs.createWriteStream(outputFilePath);
  const debugFile = fs.createWriteStream(debugFilePath);
  */

  const incrementListener = new IncrementMutator()
  const boundaryListener = new BoundaryConditionMutator()

  // Create composite listener using Proxy
  const listener = new CompositeListener([incrementListener, boundaryListener])

  ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree)

  console.log(listener._mutations)

  // Iterate through each mutation and create mutated versions
  for (const [mutatorClass, token, replacementText] of listener._mutations) {
    // Create a new token stream for each mutation
    const mutatedLexer = new ApexLexer(
      new CaseInsensitiveInputStream(
        'other',
        "public class Hello {public void MyMethod(){Integer i = 0; i++; --i; if(i == 12) {System.Debug('test');}}}"
      )
    )
    const mutatedTokenStream = new CommonTokenStream(mutatedLexer)
    const mutatedParser = new ApexParser(mutatedTokenStream)
    const mutatedTree = mutatedParser.compilationUnit()

    // Create a new token stream rewriter
    const rewriter = new TokenStreamRewriter(mutatedTokenStream)

    // Apply the mutation
    rewriter.replace(token, replacementText)

    // Get the mutated code
    const mutatedCode = rewriter.getText()

    try {
      // Save mutated code to temporary file
      const mutantFileName = path.join(
        outputDirForRunName,
        `mutant_${token.tokenIndex}.cls`
      )
      fs.writeFileSync(mutantFileName, mutatedCode)

      // TODO: Deploy the mutated code and run tests
      // https://github.com/forcedotcom/source-deploy-retrieve/blob/main/HANDBOOK.md#deploy-with-a-source-path
      // This is a placeholder for deployment and test execution logic
      // const deploymentResult = await deployCode(mutantFileName);
      // https://github.com/salesforcecli/plugin-apex/blob/main/src/commands/apex/run/test.ts
      // const testResult = await runTests();

      // if (testResult.passed) {
      //   console.log(`Surviving mutant found: ${mutatorClass.name} - ${token.text} -> ${replacementText}`);
      //   // Store surviving mutant details
      // }

      // Generate Stryker-style mutation report
      const mutationReport = {
        schemaVersion: '1.0',
        thresholds: {
          high: 80,
          low: 60,
        },
        files: {
          [mutantFileName]: {
            language: 'apex',
            mutants: [
              {
                id: token.tokenIndex.toString(),
                mutatorName: mutatorClass.constructor.name,
                replacement: replacementText,
                original: token.text,
                status: 'Survived', // Would be determined by test results
                location: {
                  start: {
                    line: token.line,
                    column: token.charPositionInLine,
                  },
                  end: {
                    line: token.line,
                    column: token.charPositionInLine + token.text.length,
                  },
                },
              },
            ],
          },
        },
      }

      // Write mutation report to JSON file
      const reportPath = path.join(outputDirForRunName, 'mutation-report.json')
      fs.writeFileSync(reportPath, JSON.stringify(mutationReport, null, 2))
    } catch (error) {
      console.error(`Error processing mutation: ${error.message}`)
    }
    // TODO rollback changes to the file ? Or delete temporary folder ?
  }
}
