import {
   TS_CONFIG,
   PACKAGE_JSON_TEMPLATE,
   BUN_MAIN_CONTENT,
   NODE_MAIN_CONTENT,
   DB_DECORATORS_TEMPLATE
} from "../templates";

import { intro, log, outro, select, text } from "@clack/prompts";
import { isValidProjectName } from "../utils";
import { installPackages } from "pm-ninja";
import { Build } from 'forji';
import path from "path/posix";
import pc from 'picocolors';

export class CreateCommand {
   private basePath: string;
   private port: number;
   private projectName: string;
   private version: string;
   private description: string;
   private author: string;
   private packageManager: string;
   private buildPath: string;
   private runtime: string;

   constructor() {
      this.basePath = 'src';
      this.port = 3000;
      this.projectName = '';
      this.version = '1.0.0';
      this.description = 'A Backend API project';
      this.author = '';
      this.buildPath = '';
   }

   async initialize() {
      try {
         intro(pc.blue('🏗️ NajmApi Project Creation'));
         await this.promptProjectInfo();
         await this.promptPKManager();
         await this.buildProject();
         await this.addPackages();
         outro(pc.green('🎯 Project created successfully! Happy coding!! 🚀'));
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

   async promptProjectInfo() {
      this.projectName = await text({
         message: 'Enter project name:',
         placeholder: 'api-project',
         initialValue: 'api-project',
         validate: (value) => {
            if (value.trim() === '') {
               return 'Project name cannot be empty';
            }
            if (!isValidProjectName(value)) {
               return 'Please enter a valid project name (lowercase letters, numbers, hyphens, underscores)';
            }
         }
      }) as string;

      this.buildPath = path.join(process.cwd(), this.projectName);
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
            'index$ts': MAIN_CONTENT
         },

         tsconfig$json: TS_CONFIG,
         package$json: PACKAGE_JSON_TEMPLATE,
         $env: `BASE_PATH={{basePath}} # Base path for modules`
      };

      const result = await Build(structure, this.buildPath, {
         basePath: this.basePath,
         port: this.port,
         projectName: this.projectName,
         version: this.version,
         description: this.description,
         author: this.author,
         runtime: this.runtime
      });

      log.success(`NajmApi Project created successfully with the following structure:`);
      log.info(`- Root path: ${result.rootPath}`);
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
         cwd: this.buildPath,
         pm: this.packageManager
      });
   }
}