export default {
  packageManager: 'npm',
  entry: [
    'src/commands/apex/mutation/test/run.ts',
    'bin/dev.js',
    'bin/run.js',
    '**/*.{nut,test}.ts',
    '.github/**/*.yml',
  ],
  project: ['**/*.{ts,js,json,yml}'],
  ignoreDependencies: [
    '@oclif/plugin-command-snapshot',
    '@salesforce/dev-scripts',
  ],
  ignoreBinaries: ['commitlint', 'npm-check-updates'],
}
