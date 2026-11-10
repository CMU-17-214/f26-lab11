# Setup

Same toolchain as Lab 5 (Node and npm, TypeScript, vitest). If that machine
still has Node 20 or newer on it, `npm install` is the whole setup.

## 1. Node

- Node 20 or newer. Check with `node --version`.
- npm comes with Node. Check with `npm --version`.

If you are below 20, install a current release from nodejs.org, or use a
version manager such as `nvm` or `fnm`.

## 2. Install dependencies

From this directory:

```
npm install
```

This creates `node_modules/` (gitignored) from the versions pinned in
`package-lock.json`. Run it once.

## 3. Run the tests and the typechecker

```
npm test
npm run typecheck
```

`npm test` runs vitest, which executes the TypeScript directly.
`npm run typecheck` runs `tsc --noEmit`, which only reports type errors. Both should be green before you start, and both have to be
green when you finish.

## 4. Run the demos

```
npm run demo:replay
npm run demo:failure
```

These run through `tsx`, which is installed with everything else and runs a
TypeScript file directly. The demos print to standard output and don't write
to disk, so run them as often as you like. They are not part of the suite, and
CI does not run them.

## 5. fast-check

`fast-check` is installed and unused. `tests/optionalProperty.test.ts` has an
optional property-based test at the bottom, commented out, for milestone 2.
Uncommenting it is the whole setup.

Start the uncomment at the `// import fc` line and leave the prose above it
commented. The paragraph over the import explains the property, but stripping
the slashes from it puts English where TypeScript expects code.

## 6. Editor

Any editor works. VS Code has TypeScript support built in, so errors show up as
you type once you open this folder as the project root. If you use something
else, make sure it picks up `tsconfig.json` from this directory.

## 7. Continuous integration

CI is already configured. When you push, `.github/workflows/ci.yml` runs
`npm ci`, `npm run typecheck`, and `npm test` and reports a green or red result
on the Actions tab of your fork. GitHub disables workflows on a fresh fork,
so open the Actions tab on your fork and click the button to enable them
before your first push.
