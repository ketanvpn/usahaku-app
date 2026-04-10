'use strict';
/**
 * Stub replacement for the "bindings" package used by better-sqlite3.
 *
 * In a packaged Electron app (with extraResources), the real "bindings"
 * package and its transitive dependency "file-uri-to-path" are not included.
 * This stub locates the native binary directly using a known relative path,
 * avoiding all transitive dependency issues.
 *
 * better-sqlite3/lib/database.js calls:
 *   require('bindings')('better_sqlite3.node')
 *
 * This stub is placed at:
 *   resources/backend/node_modules/bindings/index.js
 *
 * The binary is at:
 *   resources/backend/node_modules/better-sqlite3/build/Release/better_sqlite3.node
 */
const path = require('path');

module.exports = function bindings(filename) {
  const name = filename.replace(/(\.node)?$/, '') + '.node';

  const bsDir = process.env.BETTER_SQLITE3_PATH
    ? process.env.BETTER_SQLITE3_PATH
    : path.resolve(__dirname, '..', 'better-sqlite3');

  const candidates = [
    path.join(bsDir, 'build', 'Release', name),
    path.join(bsDir, 'build', 'Debug', name),
    path.join(bsDir, 'prebuilds', process.platform + '-' + process.arch, name),
    path.join(bsDir, name),
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND') throw e;
    }
  }

  throw new Error(
    '[bindings-stub] Cannot find native module "' + name + '".\n' +
    'Tried paths:\n' + candidates.map(c => '  ' + c).join('\n') + '\n' +
    'BETTER_SQLITE3_PATH=' + (process.env.BETTER_SQLITE3_PATH || '(not set)')
  );
};
