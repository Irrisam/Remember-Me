import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

/** Validateurs JSON Schema de la spec (spec/v0), pour vérifier ce que l'app écrit. */
const spec = (name) => JSON.parse(readFileSync(new URL(`../../spec/v0/${name}`, import.meta.url), 'utf8'));
// strictTypes coupé : la spec met des contraintes dans des if/then sans répéter le type, c'est du 2020-12 valide.
const ajv = new Ajv2020({ allErrors: true, strictTypes: false });
addFormats(ajv);
ajv.addSchema(spec('manifest.schema.json'));
ajv.addSchema(spec('entry.schema.json'));

export const validManifest = ajv.getSchema('https://remember-me.app/spec/v0/manifest.schema.json');
export const validEntry = ajv.getSchema('https://remember-me.app/spec/v0/entry.schema.json');
