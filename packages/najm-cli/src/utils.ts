import stripJsonComments from 'strip-json-comments';

export function cleanJsonString(str: string): string {
   let cleaned = stripJsonComments(str).trim();
   cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
   cleaned = cleaned.replace(/,(\s*})/g, '$1');
   cleaned = cleaned.replace(/,(\s*\])/g, '$1');
   return cleaned;
}

export function isValidProjectName(name) {
   if (!name) return false;
   
   // Basic npm naming rules
   return /^[a-z0-9-_]+$/i.test(name) && 
          name.toLowerCase() === name &&
          name.length <= 214 &&
          !name.startsWith('.');
 }

 export function isNumber(value) {
   if (value === null || value === undefined) return false;
   if (typeof value === 'number') return !isNaN(value);
   if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') return false;
      return !isNaN(Number(trimmed)) && isFinite(Number(trimmed));
   }
   return false;
}

export function validatePort(value) {
   if (!value.trim()) return undefined;
   if (!isNumber(value)) return 'Port must be a valid number';
   const port = Number(value);
   if (port < 1 || port > 65535) return 'Port must be between 1 and 65535';
   return undefined;
}

export function validateHostname(value) {
   if (!value.trim()) return undefined;

   const hostnameRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
   if (!['localhost', '127.0.0.1'].includes(value) && !hostnameRegex.test(value)) {
      return 'Invalid hostname format';
   }
   return undefined;
}