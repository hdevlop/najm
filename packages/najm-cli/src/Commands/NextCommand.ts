import {
   TS_CONFIG,
   DB_DECORATORS_TEMPLATE,
   NEXT_TEMPLATE,
   AUTH_CONFIG_TEMPLATE,
   SESSION_TEMPLATE,
   PROXY_TEMPLATE,
   PROTECTED_LAYOUT_TEMPLATE,
} from "../templates";
import { confirm, intro, log, outro, select, text } from "@clack/prompts";
import { readFile } from 'fs/promises';
import { cleanJsonString } from "../utils";
import { installPackages, pathExists } from "pm-ninja";
import { Build } from 'forji';
import path from "path/posix";
import pc from 'picocolors';
import { Env } from "dotenv-pro";

export class NextCommand {
   private basePath: string;
   private port: number;
   private packageManager: string;
   private runtime: string;
   private withAuth: boolean;

   constructor() {
      this.basePath = 'src';
      this.port = 3000;
      this.withAuth = false;
   }

   async initialize() {
      try {
         intro(pc.blue('🏗️ NajmApi Project NetxtJs Initialization'));
         await this.promptBasePath();
         await this.promptAuth();
         await this.promptPKManager();
         await this.buildProject();
         await this.addPackages();
         if (this.withAuth) this.explainAuth();
         outro(pc.green('🎯 NajmApi initialized in existing project, Happy coding!! 🚀'));
      } catch (error) {
         console.error('An error occurred:', error);
         process.exit(1);
      }
   }

   async promptPKManager() {
      const packageManagerOptions = [
         { value: 'bun', label: 'bun' },
         { value: 'npm', label: 'npm' },
         { value: 'yarn', label: 'yarn' },
         { value: 'pnpm', label: 'pnpm' },
      ];

      this.packageManager = await select({
         message: 'Which Package Manager would you like to use?',
         options: packageManagerOptions
      }) as string;

      this.runtime = this.packageManager === 'bun' ? 'bun' : 'node';
   }

   async promptAuth() {
      this.withAuth = await confirm({
         message: 'Scaffold the najm-auth App Router boundary (lib/auth.ts, lib/session.ts, proxy.ts)?',
         initialValue: true,
      }) as boolean;
   }

   async promptBasePath() {
      this.basePath = await text({
         message: 'Enter server path (default: src/server):',
         placeholder: 'src/server',
         initialValue: 'src/server'
      }) as string;

      // Save to environment
      const env = Env();
      env.add('BASE_PATH', this.basePath, 'Base path for modules');
      log.info(`Base path saved to environment: ${this.basePath}`);
   }

   async getTSDefaultConfig() {
      const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');

      const exists = await pathExists(tsconfigPath);
      if (exists) {
         const existingConfig = await readFile(tsconfigPath, 'utf-8');
         const cleanConfig = cleanJsonString(existingConfig).trim();
         const config = JSON.parse(cleanConfig);
         const needsUpdate = !config.compilerOptions?.experimentalDecorators ||
            !config.compilerOptions?.emitDecoratorMetadata;

         if (needsUpdate) {
            config.compilerOptions = config.compilerOptions || {};
            config.compilerOptions.experimentalDecorators = true;
            config.compilerOptions.emitDecoratorMetadata = true;
         }

         return JSON.stringify(config, null, 2)
      } else {
         return TS_CONFIG;
      }
   }

   async buildProject() {
      const pathParts = this.basePath.split('/');
      const baseDir = pathParts[0]; 
      const serverDir = pathParts.slice(1).join('/');

      // auth.ts is imported by the browser, the Edge proxy, and the server;
      // session.ts only by Server Components. They are separate files because
      // no single module can satisfy both boundaries.
      const authFiles = this.withAuth
         ? {
            lib: {
               auth$ts: AUTH_CONFIG_TEMPLATE,
               session$ts: SESSION_TEMPLATE,
            },
            proxy$ts: PROXY_TEMPLATE,
         }
         : {};

      const structure = {
         [baseDir]: {
            [serverDir]: {
               modules: {
                  index$ts: ''
               },
               shared: {
                  decorators: {
                     index$ts: DB_DECORATORS_TEMPLATE,
                  },
                  guards: {},
                  services: {},
                  utils: {}
               },
               index$ts: NEXT_TEMPLATE
            },
            ...authFiles,
         },

         tsconfig$json: await this.getTSDefaultConfig(),
      };

      const result = await Build(structure, process.cwd(), {
         basePath: this.basePath,
         port: this.port,
         runtime: this.runtime
      });

      log.success(`NajmApi Project initialized successfully with the following structure:`);
      log.info(`- Created files:`);
      Object.entries(result.files).forEach(([name, filePath]) => {
         log.info(`  - ${name}: ${filePath}`);
      });

      return result;
   }

   async addPackages() {
      const dependencies = ['hono', 'najm-api', 'reflect-metadata'];

      if (this.withAuth) {
         // server-only turns an accidental client import of session.ts into a
         // named build error instead of a bundling surprise.
         dependencies.push('najm-auth', 'server-only');
      }

      const packages = {
         dependencies,
         devDependencies: ['typescript', '@types/node']
      };

      await installPackages(packages, {
         cwd: process.cwd(),
         pm: this.packageManager
      });
   }

   explainAuth() {
      log.info(
         'Auth boundary created. Keep auth.ts and session.ts separate: auth.ts is\n' +
         'reachable from the browser and the Edge proxy, session.ts must not be.\n' +
         'Merging them breaks the middleware, client, SSR, and server graphs at once.'
      );
      log.info(
         `Guard a protected segment like this:\n\n${PROTECTED_LAYOUT_TEMPLATE}`
      );
   }
}