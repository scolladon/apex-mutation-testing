export default {
  clearMocks: true,
  testEnvironment: 'node',
  testMatch: ['**/test/nut/**/*.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '\\.ts$': [
      'ts-jest',
      {
        tsconfig: './tsconfig.json',
        useESM: true,
        diagnostics: { ignoreCodes: [151002, 1378] },
      },
    ],
  },
  moduleNameMapper: {
    '(.+)\\.js': '$1',
  },
}
