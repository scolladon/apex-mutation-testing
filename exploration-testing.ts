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

export class CompositeListener implements ApexParserListener {
  private listeners: BaseListener[];
  _mutations: any[] = [];

  constructor(listeners: BaseListener[]) {
    this.listeners = listeners;
    // Share mutations array across all listeners
    this.listeners
      .filter((listener) => '_mutations' in listener)
      .forEach((listener) => {
        (listener as any)._mutations = this._mutations;
      });

    // Create a proxy that automatically forwards all method calls to listeners
    return new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) {
          return target[prop];
        }

        // Return a function that calls the method on all listeners that have it
        return (...args: any[]) => {
          this.listeners.forEach((listener) => {
            if (prop in listener && typeof listener[prop] === 'function') {
              (listener[prop] as Function).apply(listener, args);
            }
          });
        };
      },
    });
  }
}

class BaseListener implements ApexParserListener {
  _mutations: any[] = [];
}

export class BoundaryConditionMutator extends BaseListener {
  REPLACEMENT_MAP = {
    '!=': '==',
    '==': '!=',
    '<': '<=',
    '<=': '<',
    '>': '>=',
    '>=': '>',
    '===': '!==',
    '!==': '===',
  };

  // Target rule
  // expression: expression ('<=' | '>=' | '>' | '<') expression
  enterParExpression(ctx: ParserRuleContext): void {
    if (ctx.childCount === 3) {
      const symbol = ctx.getChild(1).getChild(1);
      if (symbol instanceof TerminalNode) {
        const symbolText = symbol.text;
        const replacement = this.REPLACEMENT_MAP[symbolText];
        if (replacement) {
          this._mutations.push([this.constructor, symbol, replacement]);
        }
      }
    }
  }
}

export class IncrementMutator extends BaseListener {
  REPLACEMENT_MAP = {
    '++': '--',
    '--': '++',
  };

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
        this._mutations.push([this.constructor, symbol, this.REPLACEMENT_MAP[symbol.text]]);
      }
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
        this._mutations.push([this.constructor, symbol, this.REPLACEMENT_MAP[symbol.text]]);
      }
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

  const incrementListener = new IncrementMutator();
  const boundaryListener = new BoundaryConditionMutator();

  // Create composite listener using Proxy
  const listener = new CompositeListener([incrementListener, boundaryListener]);

  ParseTreeWalker.DEFAULT.walk(listener as ApexParserListener, tree);

  console.log(listener._mutations);
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
