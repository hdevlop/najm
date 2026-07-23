import { TS_CONFIG, BUN_MAIN_CONTENT, NODE_MAIN_CONTENT, DB_DECORATORS_TEMPLATE } from "../templates";
import { intro, log, outro, select, text } from "@clack/prompts";
import { readFile } from 'fs/promises';
import { cleanJsonString } from "../utils";
import { installPackages, pathExists } from "pm-ninja";
import { Build } from 'forji';
import path from "path/posix";
import pc from 'picocolors';
import { Env } from "dotenv-pro";

export class InitCommand {
   private basePath: string;
   private port: number;
   private packageManager: string;
   private runtime: string;

   constructor() {
      this.basePath = 'src';
      this.port = 3000;
   }

   async initialize() {
      try {
         intro(pc.blue('🏗️ NajmApi Project Initialization'));
         await this.promptBasePath();
         await this.promptPKManager();
         await this.buildProject();
         await this.addPackages();
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

   async promptBasePath() {
      this.basePath = await text({
         message: 'Enter base path (e.g., src, src/server):',
         placeholder: 'src',
         initialValue: 'src'
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
      const MAIN_CONTENT = this.runtime === 'bun' ? BUN_MAIN_CONTENT : NODE_MAIN_CONTENT;

      const structure = {
         '{{basePath}}': {
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
            index$ts: MAIN_CONTENT
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
      const packages = {
         dependencies: ['hono', 'najm-api', 'reflect-metadata'],
         devDependencies: ['typescript', '@types/node']
      };

      await installPackages(packages, {
         cwd: process.cwd(),
         pm: this.packageManager
      });
   }
}