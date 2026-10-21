import {deepStrictEqual} from 'node:assert/strict';
import {ok} from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {join} from 'node:path';
import {relative} from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

// A static import or re-export that is not type-only. A dynamic import()
// in a function does not match, because its module loads at the call.
const staticFrom =
  /^\s*(?:import|export)\s+(?!type\b)[\w$*{},\s]*?\bfrom\s*['"]([^'"]+)['"]/gm;

// An import for side effects, for example import './setup.js'
const sideEffect = /^\s*import\s*['"]([^'"]+)['"]/gm;

// A dynamic import() at the top level, not in a function, runs when the
// module loads. The match is a line with no indent and no function.
const topLevelImport = /^(?!.*=>)(?!.*\bfunction\b)\S.*\bimport\s*\(/m;

// Block comments and line comments, for example an import in a doc comment
const comments = /\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm;

/** Follow the static imports of a source file

  {
    entry: <Source File Path Relative to the Repo Root String>
  }

  @returns
  {
    files: [<Source File Path Relative to the Repo Root String>]
    packages: [<Package Specifier String>]
    topLevelImports: [<Source File Path With a Top Level import() String>]
  }
*/
const staticImports = ({entry}: {entry: string}) => {
  const files = new Set<string>();
  const packages = new Set<string>();
  const topLevel: string[] = [];
  const queue = [join(root, entry)];

  while (queue.length) {
    const file = queue.shift()!;

    if (files.has(file)) {
      continue;
    }

    files.add(file);

    const text = readFileSync(file, 'utf8').replace(comments, '$1');

    if (topLevelImport.test(text)) {
      topLevel.push(relative(root, file));
    }

    const specs = [
      ...text.matchAll(staticFrom),
      ...text.matchAll(sideEffect),
    ].map(match => match[1]);

    specs.forEach(spec => {
      if (!spec.startsWith('.')) {
        packages.add(spec);
      } else {
        // The source imports name the .js output of each .ts file
        queue.push(join(dirname(file), spec.replace(/\.js$/, '.ts')));
      }
    });
  }

  return {
    files: [...files].map(file => relative(root, file)).sort(),
    packages: [...packages].sort(),
    topLevelImports: topLevel.sort(),
  };
};

test('The SDK entry loads only Node.js modules', () => {
  const {files, packages, topLevelImports} = staticImports({
    entry: 'src/index.ts',
  });

  // The walk reaches the Docker backend maker
  ok(files.includes('src/polar_docker/make_polar_docker.ts'));

  // The Docker tool runner and the gRPC code load at the first tool call
  deepStrictEqual(
    files.filter(
      file =>
        file === 'src/polar_docker/execute_tool.ts' ||
        file.startsWith('src/lnd_grpc/'),
    ),
    [],
  );

  deepStrictEqual(
    packages.filter(name => !name.startsWith('node:')),
    [],
  );

  deepStrictEqual(topLevelImports, []);
});

test('The Docker tool runner loads gRPC', () => {
  const {packages} = staticImports({
    entry: 'src/polar_docker/execute_tool.ts',
  });

  ok(packages.includes('@grpc/grpc-js'));
  ok(packages.includes('@grpc/proto-loader'));
});
