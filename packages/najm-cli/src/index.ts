#!/usr/bin/env node
import { log } from "@clack/prompts";
import { showHelp } from "./help";
import { InitCommand } from "./Commands/InitCommand";
import { DBCommand } from "./Commands/DBCommand";
import { CreateCommand } from "./Commands/CreateCommand";
import { NextCommand } from "./Commands/NextCommand";
import { ComponentType, NewCommand } from "./Commands/NewCommand";
import { ChatSeedCommand } from "./Commands/ChatSeedCommand";
import { RagInitCommand } from "./Commands/RagInitCommand";
import { RagScanCommand } from "./Commands/RagScanCommand";


async function main() {
   try {
      const args = process.argv.slice(2);
      const command = args[0];
      const subCommand = args[1];
      const componentName = args[2];

      switch (command) {
         case 'create':
            const createCmd = new CreateCommand();
            await createCmd.initialize();
            break;

         case 'init':
            if (subCommand === 'next') {
               const nextCmd = new NextCommand();
               await nextCmd.initialize();
            } else {
               const initCmd = new InitCommand();
               await initCmd.initialize();
            }
            break;

         case 'new':
            let componentType: ComponentType | undefined = undefined;
            if (subCommand) {
               switch (subCommand.toLowerCase()) {
                  case 'controller':
                  case 'service':
                  case 'repository':
                  case 'module':
                     componentType = subCommand.toLowerCase() as ComponentType;
                     break;
                  default:
                     log.error(`Unknown component type: ${subCommand}`);
                     log.info('Supported types: controller, service, repository, module');
                     process.exit(1);
               }
            }

            const newCmd = new NewCommand(componentType, componentName);
            await newCmd.initialize();
            break;

         case 'database':
            const dbCommand = new DBCommand();
            await dbCommand.initialize();
            break;

         case 'chat:seed':
            const chatSeedCmd = new ChatSeedCommand();
            if (subCommand === '--help' || subCommand === '-h' || subCommand === 'help') {
               chatSeedCmd.showHelp();
               break;
            }
            await chatSeedCmd.initialize();
            break;

         case 'rag:init':
            const ragInitCmd = new RagInitCommand();
            if (subCommand === '--help' || subCommand === '-h' || subCommand === 'help') {
               ragInitCmd.showHelp();
               break;
            }
            await ragInitCmd.initialize();
            break;

         case 'rag:scan':
            const ragScanCmd = new RagScanCommand();
            if (subCommand === '--help' || subCommand === '-h' || subCommand === 'help') {
               ragScanCmd.showHelp();
               break;
            }
            await ragScanCmd.initialize(args.slice(1));
            break;

         case 'help':
         case '--help':
         case '-h':
            await showHelp();
            break;
         default:
            if (!command) {
               log.warn('No command specified. Use "najm init" to create a new project.');
               await showHelp();
            } else {
               log.error(`Unknown command: ${command}`);
               await showHelp();
            }
            break;
      }

      setTimeout(() => {
         process.exit(0);
      }, 100);
   } catch (error) {
      console.error('An error occurred:', error);
      process.exit(1);
   }
}

main();
