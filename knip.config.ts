export default {
  entry: [
    'src/commands/apex/mutation/test/run.ts',
    'bin/dev.js',
    '**/*.{nut,test}.ts',
    '.github/**/*.yml',
  ],
  project: ['**/*.{ts,js,json,yml}'],
  ignoreDependencies: [
    '@commitlint/config-conventional',
    '@stryker-mutator/core',
  ],
  ignoreBinaries: ['commitlint', 'npm-check-updates', 'sf'],
}
