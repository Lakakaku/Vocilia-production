import { writeFileSync } from 'fs';
import { join } from 'path';
import { swaggerSpec } from './openapi';

const outPath = join(__dirname, 'openapi.json');
writeFileSync(outPath, JSON.stringify(swaggerSpec, null, 2));
console.log('OpenAPI spec written to', outPath);


