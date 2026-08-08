// Identifier normalization moved to `../identity`, where the configurable
// country presets live. Re-exported here so existing deep imports keep working.
export {
  createIdentityResolver,
  isEmailIdentifier,
  normalizeAuthIdentifier,
  type IdentityResolver,
} from '../identity/resolver';
