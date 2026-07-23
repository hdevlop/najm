import pc from 'picocolors';

/**
 * Displays help information for the CLI
 */
export async function showHelp() {
  console.log(`
${pc.blue('NajmApi Backend CLI')} ${pc.green('v0.1.0')}

${pc.yellow('USAGE:')}
  najm <command>

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
  najm new controller UserController    Create a new controller
  najm new service AuthService          Create a new service
  najm new repository ProductRepository Create a new repository
  najm new module blog                  Create a complete module

${pc.yellow('DATABASE COMMANDS:')}
  ${pc.green('db:generate')}  Generate migrations based on your schema changes
  ${pc.green('db:push')}      Push schema changes to your database
  ${pc.green('db:drop')}      Drop all database tables
  ${pc.green('db:check')}     Check migration status

${pc.yellow('RAG COMMANDS:')}
  ${pc.green('rag:init')}     Interactive scaffolding for chatbot routing config
  ${pc.green('rag:scan')}     Scan controllers and auto-fill semantics.json

${pc.yellow('EXAMPLES:')}
  najm init                        Start interactive project creation with optional DB setup
  najm new                         Start interactive component generation
  najm new controller UserController  Create a new controller
  najm new module blog             Create a complete blog module
  najm database                    Add database support to your project
  najm rag:init                    Scaffold chatbot config
  najm rag:scan                    Auto-fill semantics from controllers
  najm help                        Show this help message
  `);
} 
