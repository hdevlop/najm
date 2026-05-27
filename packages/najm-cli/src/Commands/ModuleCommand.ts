import { intro, log, outro, select, text } from "@clack/prompts";
import { Env } from "dotenv-pro";
import pc from 'picocolors';
import { pathExists } from "pm-ninja";
import path from "path/posix";
import fs from 'fs/promises';
import { API_TEST_CONTENT, CONTROLLER_CONTENT, MODULE_INDEX_CONTENT, REPOSITORY_CONTENT, SERVICE_CONTENT } from "../templates";
import { Build } from "forji";

export class ModuleCommand {
   moduleName: string;
   basePath: string;
   isNewModule: boolean = true;

   constructor() {
      this.moduleName = '';
      this.basePath = 'src';
   }

   async initialize() {
      try {
         intro(pc.blue('🏗️ NajmApi Module Generator'));
         await this.loadEnvironment();
         await this.promptModuleName();
         await this.generateModule();
         await this.updateModulesIndex();
         outro(pc.green('✅ Module generated successfully!'));
      }
      catch (error) {
         console.error('An error occurred:', error);
         process.exit(1);
      }
   }

   async generateModule() {
      if (!this.isNewModule) {
         log.warn(`Skipping module generation for '${this.moduleName}' as it already exists.`);
         return;
      }

      const structure = {
         '{{basePath}}': {
            modules: {
               '{{moduleName}}s': {
                  '{{moduleName}}Controller$ts': CONTROLLER_CONTENT,
                  '{{moduleName}}Service$ts': SERVICE_CONTENT,
                  '{{moduleName}}Repository$ts': REPOSITORY_CONTENT,
                  index$ts: MODULE_INDEX_CONTENT,
               },
            },
         },
      };

      await Build(structure, process.cwd(), {
         basePath: this.basePath,
         moduleName: this.moduleName.toUpperCase(),
      });

   }

   async updateModulesIndex() {
      const indexPath = path.join(process.cwd(), this.basePath, 'modules', 'index.ts');
      
      try {
         // Check if modules/index.ts exists
         const indexExists = await pathExists(indexPath);
         
         if (!indexExists) {
            // If it doesn't exist, create it with the export
            await fs.writeFile(
               indexPath,
               `export * from './${this.moduleName}s';\n`,
               'utf-8'
            );
            log.success(`Created modules/index.ts with export for '${this.moduleName}'.`);
            return;
         }
         
         // If it exists, read it and update if needed
         const content = await fs.readFile(indexPath, 'utf-8');
         const exportLine = `export * from './${this.moduleName}s';`;
         
         // Check if the export already exists
         if (content.includes(exportLine)) {
            log.info(`Export for '${this.moduleName}' already exists in modules/index.ts.`);
            return;
         }
         
         // Add the export line to the end
         let newContent = content;
         
         // If the file doesn't end with a newline, add one
         if (!content.endsWith('\n')) {
            newContent += '\n';
         }
         
         // Add the export line
         newContent += `${exportLine}\n`;
         
         // Write the updated content back to the file
         await fs.writeFile(indexPath, newContent, 'utf-8');
         log.success(`Updated modules/index.ts to include export for '${this.moduleName}'.`);
      } catch (error) {
         log.error(`Failed to update modules/index.ts: ${error.message}`);
      }
   }

   async promptModuleName() {
      this.moduleName = await text({
         message: 'Enter module name:',
         placeholder: 'user',
         initialValue: 'user'
      }) as string;

      const modulePath = path.join(process.cwd(), this.basePath, 'modules', `${this.moduleName}s`);
      const moduleExists = await pathExists(modulePath);

      if (moduleExists) {
         log.warn(`Module '${this.moduleName}' already exists at ${modulePath}`);
         this.isNewModule = false;
      }
   }

   async promptBasePath() {
      this.basePath = await text({
         message: 'Enter base path (e.g., src, src/server):',
         placeholder: 'src',
         initialValue: 'src'
      }) as string;
   }

   async loadEnvironment() {
      const env = Env();
      if (env.has('BASE_PATH')) {
         this.basePath = env.get('BASE_PATH');
         log.info(`Using base path from environment: ${this.basePath}`);
      } else {
         await this.promptBasePath();
         env.add('BASE_PATH', this.basePath, 'Base path for modules');
         log.info(`Base path saved to environment: ${this.basePath}`);
      }
   }
}