/* eslint-disable @typescript-eslint/no-require-imports */
// tsc only uses tsconfig "paths" for type resolution, not for rewriting
// emitted `require("@/...")` calls, so the compiled .test-dist output needs
// this at runtime to resolve the same "@/*" -> project-root alias Next.js
// resolves at build/bundle time. Preloaded via `node --require` in the
// "test" npm script, before any test file requires compiled modules.
const path = require("node:path");
const Module = require("node:module");

const testDistRoot = path.join(__dirname, "..", ".test-dist");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveWithAlias(request, ...rest) {
  if (request.startsWith("@/")) {
    request = path.join(testDistRoot, request.slice(2));
  }
  return originalResolveFilename.call(this, request, ...rest);
};
