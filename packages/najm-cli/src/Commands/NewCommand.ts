import { intro, log, outro, select, text } from "@clack/prompts";
import { Env } from "dotenv-pro";
import pc from 'picocolors';
import { pathExists } from "pm-ninja";
import path from "path/posix";
import fs from 'fs/promises';
import { CONTROLLER_CONTENT, REPOSITORY_CONTENT, SERVICE_CONTENT } from "../templates";
import { Build } from "forji";

export type ComponentType = 'controller' | 'service' | 'repository' | 'module';

export class NewCommand {
  private basePath: string;
  private componentName: string;
  private componentType: ComponentType;
  private moduleName: string;
  private moduleNameUpper: string;

  constructor(type?: ComponentType, name?: string) {
    this.basePath = 'src';
    this.componentName = name || '';
    this.componentType = type || 'controller';
    this.moduleName = '';
    this.moduleNameUpper = ''; 
  }

  async initialize() {
    try {
      intro(pc.blue('🏗️ NajmApi Component Generator'));
      await this.loadEnvironment();
      
      if (!this.componentName) {
        await this.promptComponentType();
        await this.promptComponentName();
      }
      
      await this.processModuleName();
      await this.generateComponent();
      
      outro(pc.green(`✅ ${this.componentType} generated successfully!`));
    }
    catch (error) {
      console.error('An error occurred:', error);
      process.exit(1);
    }
  }

  private async promptComponentType() {
    this.componentType = await select({
      message: 'What type of component do you want to create?',
      options: [
        { value: 'controller', label: 'Controller' },
        { value: 'service', label: 'Service' },
        { value: 'repository', label: 'Repository' },
        { value: 'module', label: 'Full Module (Controller+Service+Repository)' }
      ]
    }) as ComponentType;
  }

  private async promptComponentName() {
    this.componentName = await text({
      message: `Enter ${this.componentType} name:`,
      placeholder: 'user',
      initialValue: ''
    }) as string;

    if (!this.componentName) {
      log.error('Component name cannot be empty');
      process.exit(1);
    }
  }

  private async processModuleName() {
    if (this.componentType !== 'module') {
      const suffixes = ['Controller', 'Service', 'Repository'];
      
      for (const suffix of suffixes) {
        if (this.componentName.endsWith(suffix)) {
          this.moduleName = this.componentName.substring(0, this.componentName.length - suffix.length).toLowerCase();
          return;
        }
      }
    } 
    this.moduleName = this.componentName.toLowerCase();
    this.moduleNameUpper= this.moduleName.charAt(0).toUpperCase() + this.moduleName.slice(1);
  }

  private async generateComponent() {
    const structure: any = {
      '{{basePath}}': {
        modules: {
          '{{moduleName}}s': {}
        }
      }
    };

    // Add the appropriate files based on component type
    if (this.componentType === 'controller' || this.componentType === 'module') {
      structure['{{basePath}}'].modules['{{moduleName}}s']['{{moduleName}}Controller$ts'] = CONTROLLER_CONTENT;
    }
    
    if (this.componentType === 'service' || this.componentType === 'module') {
      structure['{{basePath}}'].modules['{{moduleName}}s']['{{moduleName}}Service$ts'] = SERVICE_CONTENT;
    }
    
    if (this.componentType === 'repository' || this.componentType === 'module') {
      structure['{{basePath}}'].modules['{{moduleName}}s']['{{moduleName}}Repository$ts'] = REPOSITORY_CONTENT;
    }

    // If it's a full module, also add the index.ts file
    if (this.componentType === 'module') {
      structure['{{basePath}}'].modules['{{moduleName}}s']['index$ts'] = 
        `export * from './{{moduleName}}Controller';\n` +
        `export * from './{{moduleName}}Service';\n` +
        `export * from './{{moduleName}}Repository';\n`;
    }

    const result = await Build(structure, process.cwd(), {
      basePath: this.basePath,
      moduleName: this.moduleName,
      moduleNameUpper:this.moduleNameUpper
    });

    log.success(`Generated the following files:`);
    Object.entries(result.files).forEach(([name, filePath]) => {
      log.info(`  - ${name}: ${filePath}`);
    });

    // Update modules index if it's a new module
    if (this.componentType === 'module') {
      await this.updateModulesIndex();
    }
  }

  private async updateModulesIndex() {
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

  private async loadEnvironment() {
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

  private async promptBasePath() {
    this.basePath = await text({
      message: 'Enter base path (e.g., src, src/server):',
      placeholder: 'src',
      initialValue: 'src'
    }) as string;
  }
}