// Morocco identity helpers — `najm-auth/identity/ma`.
//
// `ma` is the default preset, so an app in Morocco imports nothing from here
// unless it needs the CIN temporary credential for provisioning.

export {
  moroccoIdentityPreset,
  normalizeMoroccanPhone,
} from './presets';

export {
  MOROCCAN_CIN_TEMPORARY_CREDENTIAL_KIND,
  isMoroccanCin,
  moroccanCinTemporaryCredential,
  normalizeMoroccanCin,
} from './temporaryCredential';

export type { TemporaryCredential, TemporaryCredentialInput } from './temporaryCredential';
