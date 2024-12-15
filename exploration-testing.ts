import {
  CommonTokenStream,
  ApexLexer,
  CaseInsensitiveInputStream,
  ApexParser,
  ParseTreeWalker,
  ApexParserListener,
} from 'apex-parser';
import path from 'node:path';
import fs from 'node:fs';
import { ParserRuleContext } from 'antlr4ts';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';
import { ComparisonOperatorContext, ParExpressionContext } from 'apex-parser/lib/ApexParser';

export class Listener implements ApexParserListener {
  _parser: ApexParser;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  _mutations: any[] = []; // Replace 'any' with the specific type of your mutations

  constructor(parser: ApexParser) {
    this._parser = parser;
  }
}

export class ListenerDecoratorBase extends Listener {
  _listener: Listener;

  constructor(listener: Listener) {
    super(listener._parser); // Call the constructor of the base class
    this._listener = listener;
  }
}

export class BoundaryConditionMutator extends ListenerDecoratorBase {
  REPLACEMENT_MAP = {
    '!=': '==',
    '==': '!=',
    '<': '<=',
    '<=': '<',
    '>': '>=',
    '>=': '>',
  };

  constructor(listener: Listener) {
    super(listener);
  }

  // Target rule
  // expression: expression ('<=' | '>=' | '>' | '<') expression
  enterEqualityExpression(ctx: ParExpressionContext): void {
    if (ctx.childCount === 3 && ctx.getChild(1) instanceof TerminalNode) {
      const symbol = ctx.getChild(1) as TerminalNode;

      if (symbol?.text in this.REPLACEMENT_MAP) {
        this._listener._mutations.push([this.constructor, symbol, this.REPLACEMENT_MAP[symbol.text]]);
        console.log(symbol.text);
      }
    }
  }
}

export class IncrementMutator extends ListenerDecoratorBase {
  REPLACEMENT_MAP = {
    '++': '--',
    '--': '++',
  };

  constructor(listener: Listener) {
    super(listener);
  }

  // Target rule
  // expression :
  //  | expression ('++' | '--')
  //  | ('+' | '-' | '++' | '--') expression
  enterPostOpExpression(ctx: ParserRuleContext): void {
    if (ctx.childCount === 2) {
      let symbol: TerminalNode | null = null;
      if (ctx.getChild(0) instanceof TerminalNode) {
        symbol = ctx.getChild(0) as TerminalNode;
      } else if (ctx.getChild(1) instanceof TerminalNode) {
        symbol = ctx.getChild(1) as TerminalNode;
      }

      if (symbol?.text in this.REPLACEMENT_MAP) {
        this._listener._mutations.push([this.constructor, symbol, this.REPLACEMENT_MAP[symbol.text]]);
      }
      console.log(symbol.text);
    }
  }

  enterPreOpExpression(ctx: ParserRuleContext): void {
    if (ctx.childCount === 2) {
      let symbol: TerminalNode | null = null;
      if (ctx.getChild(0) instanceof TerminalNode) {
        symbol = ctx.getChild(0) as TerminalNode;
      } else if (ctx.getChild(1) instanceof TerminalNode) {
        symbol = ctx.getChild(1) as TerminalNode;
      }

      if (symbol !== null && symbol.text in this.REPLACEMENT_MAP) {
        this._listener._mutations.push([this.constructor, symbol, this.REPLACEMENT_MAP[symbol.text]]);
      }
      console.log(symbol.text);
    }
  }
}

run();

function run() {
  const ROOT_OUTPUT_DIR = 'output';
  const outputDirForRunName = path.join(ROOT_OUTPUT_DIR, `run_at_${Math.floor(Date.now() / 1000)}`);

  if (!fs.existsSync(ROOT_OUTPUT_DIR)) {
    fs.mkdirSync(ROOT_OUTPUT_DIR);
  }
  fs.mkdirSync(outputDirForRunName);

  //  const inputFileStream = fs.readFileSync(inputFileName, 'utf8');
  const lexer = new ApexLexer(
    new CaseInsensitiveInputStream(
      'other',
      "public class Hello {public void MyMethod(){Integer i = 0; i++; --i; if(i == 12) {System.Debug('test');}}}"
    )
  );
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new ApexParser(tokenStream);
  const tree = parser.compilationUnit();

  /*
  const outputFilePath = path.join(outputDirForRunName, 'output.txt');
  const debugFilePath = path.join(outputDirForRunName, 'debug.txt');
  const outputFile = fs.createWriteStream(outputFilePath);
  const debugFile = fs.createWriteStream(debugFilePath);
  */

  const baseListener = new Listener(parser);
  const incrementListener = new IncrementMutator(baseListener);
  const boundaryListener = new BoundaryConditionMutator(baseListener);
  /*
  listener = new OutputDecorator(listener, outputFile);
  listener = new DebugDecorator(listener, debugFile);
  listener = new BoundaryConditionMutator(listener);
  listener = new IncrementMutator(listener);
  */
  ParseTreeWalker.DEFAULT.walk(boundaryListener as ApexParserListener, tree);
  // biome-ignore lint/suspicious/noConsoleLog: <explanation>
  console.log(baseListener._mutations);
  //walker.walk(listener as ApexParserListener, tree);
  //console.log(listener);

  // begin running mutations
  /*listener.mutations.forEach((mutation, i) => {
    const [mutatingClass, inputToken, replacementText] = mutation;
    console.log(`${i}: ${mutatingClass.name} mutating ${inputToken.text} to ${replacementText}`);
    console.log(inputToken.tokenIndex);
  });*/

  /*const streamLength = tokenStream.tokens.length;
  for (const program of rewriter.programs) {
    const outFilePath = path.join(outputDirForRunName, `${program}.txt`);
    fs.writeFileSync(outFilePath, rewriter.getText(program, 0, streamLength));
  }*/
}
