import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Map jose ESM imports to the same ESM file (needed for Jest ESM mode)
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'esnext',
          moduleResolution: 'bundler',
        },
      },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
};

export default config;
