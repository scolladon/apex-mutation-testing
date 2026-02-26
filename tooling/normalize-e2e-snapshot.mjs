import { readFileSync, writeFileSync } from 'node:fs'

const file = 'test/e2e/index.html'
const content = readFileSync(file, 'utf8')
writeFileSync(file, content.replace(/[0-9]{13}/g, 'E2E_TEST'))
