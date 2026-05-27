import pc from 'picocolors';

/**
 * Displays help information for the CLI
 */
export async function showHelp() {
  console.log(`
${pc.blue('NajmApi Backend CLI')} ${pc.green('v0.1.0')}

${pc.yellow('USAGE:')}
  najm-api <command>

${pc.yellow('COMMANDS:')}
  ${pc.green('init')}         Initialize a new NajmApi project with optional database setup
  ${pc.green('create')}       Create a new project from scratch
  ${pc.green('new')}          Create a specific component (controller, service, repository, or module)
  ${pc.green('database')}     Add database support to an existing project
  ${pc.green('chat:seed')}    Seed dev AI settings (defaults to ollama/llama3.1)
  ${pc.green('rag:init')}     Scaffold chatbot routing config, semantics, and test fixtures
  ${pc.green('rag:scan')}     Auto-fill semantics and routing heuristics from @McpTool controllers
  ${pc.green('help')}         Show this help message

${pc.yellow('NEW COMMAND USAGE:')}
  najm-api new controller UserController    Create a new controller
  najm-api new service AuthService          Create a new service
  najm-api new repository ProductRepository Create a new repository
  najm-api new module blog                  Create a complete module

${pc.yellow('DATABASE COMMANDS:')}
  ${pc.green('db:generate')}  Generate migrations based on your schema changes
  ${pc.green('db:push')}      Push schema changes to your database
  ${pc.green('db:drop')}      Drop all database tables
  ${pc.green('db:check')}     Check migration status

${pc.yellow('RAG COMMANDS:')}
  ${pc.green('rag:init')}     Interactive scaffolding for chatbot routing config
  ${pc.green('rag:scan')}     Scan controllers and auto-fill semantics.json

${pc.yellow('EXAMPLES:')}
  najm-api init                        Start interactive project creation with optional DB setup
  najm-api generate                    Start interactive component generation
  najm-api new controller UserController  Create a new controller
  najm-api new module blog             Create a complete blog module
  najm-api db:setup                    Add database support to your project
  najm-api rag:init                    Scaffold chatbot config
  najm-api rag:scan                    Auto-fill semantics from controllers
  najm-api help                        Show this help message
  `);
} 
