import { DB_TEMPLATES, DB_TEST_TEMPLATES, DRIZZLE_CONFIG_TEMPLATE, SCHEMA_TEMPLATES } from "../templates";
import { DATABASE_PACKAGES, DATABASE_SCRIPTS, DEFAULT_CONFIG } from '../constants';
import { group, intro, log, outro, select, text, confirm } from "@clack/prompts";
import { addScripts, installPackages, runScript } from "pm-ninja";
import { validateHostname, validatePort } from "../utils";
import { Build, getFile } from "forji";
import { DBtype } from "../types";
import { Env } from "dotenv-pro";
import pc from 'picocolors';

export class DBCommand {
  private env: ReturnType<typeof Env>;

  private dbType: DBtype = 'pg';
  private basePath: string;
  private dbHost: string = DEFAULT_CONFIG.host;
  private dbPort: number = DEFAULT_CONFIG.port;
  private dbName: string = DEFAULT_CONFIG.database;
  private dbUsername: string = DEFAULT_CONFIG.username;
  private dbPassword: string = DEFAULT_CONFIG.password;
  private dbFilePath: string = './data.db';
  private dbUrl: string = '';
  private connectionSuccess: boolean = false;

  constructor() {
    this.basePath = 'src';
    this.env = Env();
  }

  async initialize() {
    try {
      intro(pc.blue('🏗️ NajmApi Database Setup'));

      await this.loadEnvironment();
      await this.promptDBtype();
      await this.setupDBEnv()
      await this.buildProject();
      await this.addMigrationScripts();
      await this.addPackages();
      await this.testDBConnection();

      log.success(`✅ Selected database: ${pc.green(this.dbType)}`);
      log.success(`✅ Database url: ${pc.green(this.dbUrl)}`);
      log.success(`✅ Generated ${pc.green('drizzle.config.ts')}`);
      log.success(`✅ Generated database files in ${pc.green('db.ts')}`);
      log.success(`✅ Generated schema files in ${pc.green('exampleSchema.ts')}`);
      log.success(`✅ Added migration scripts to package.json for ${pc.green(this.dbType)}`);
      if (!this.connectionSuccess) {
        log.warn(pc.yellow('⚠️ Database connection failed. Please verify:'));
        log.warn(pc.yellow('  • Database name is correct'));
        log.warn(pc.yellow('  • Username and password are valid'));
        log.warn(pc.yellow('  • Database server is running'));
        log.warn(pc.yellow('  • Host and port are accessible'));
        log.warn(pc.yellow('  • Check your .env file configuration'));
        outro(pc.yellow('⚠️ Please fix database connection issues before proceeding.'));
      } else {
        outro(pc.green('✅ Database setup completed successfully! ✨'));
      }
    } catch (error) {
      log.error(pc.red('An error occurred during setup:'));
      log.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  async buildProject() {
    const structure = {
      '{{basePath}}': {
        database: {
          db$ts: DB_TEMPLATES[this.dbType],
          schema: {
            exampleSchema$ts: SCHEMA_TEMPLATES[this.dbType],
            index$ts: '// Export your schemas here\nexport * from "./exampleSchema";'
          },
          tests: {
            connectionTest$ts: DB_TEST_TEMPLATES[this.dbType]
          },
          migrations: {}
        }
      },
      'drizzle.config$ts': DRIZZLE_CONFIG_TEMPLATE[this.dbType]
    };

    return await Build(structure, process.cwd(), {
      basePath: this.basePath,
      dbType: this.dbType
    });
  }

  async testDBConnection() {
    log.info(`Testing ${this.dbType} database connection...`);
    const testFilePath = getFile('connectionTest.ts');
    const result = await runScript(testFilePath);
    if (result) {
      log.success('✅ Database connection test successful');
      this.connectionSuccess = true;
      return;
    }
    this.connectionSuccess = false;
  }

  async addMigrationScripts() {
    await addScripts(DATABASE_SCRIPTS);
  }

  async addPackages() {
    return await installPackages(DATABASE_PACKAGES[this.dbType]);
  }

  async promptPg() {
    const config = await group({
      host: () => text({
        message: `Enter database host:`,
        placeholder: DEFAULT_CONFIG.host,
        validate: validateHostname,
      }),
      port: () => text({
        message: `Enter database port:`,
        placeholder: String(DEFAULT_CONFIG.port),
        validate: validatePort,
      }),
      database: () => text({
        message: `Enter database name:`,
        placeholder: DEFAULT_CONFIG.database,
      }),
      username: () => text({
        message: `Enter database username:`,
        placeholder: DEFAULT_CONFIG.username,
      }),
      password: () => text({
        message: `Enter database password:`,
        placeholder: DEFAULT_CONFIG.password,
      }),
    });

    this.dbType = 'pg';
    this.dbHost = config.host?.trim() || DEFAULT_CONFIG.host;
    this.dbPort = config.port?.trim() ? Number(config.port) : DEFAULT_CONFIG.port;
    this.dbName = config.database?.trim() || DEFAULT_CONFIG.database;
    this.dbUsername = config.username?.trim() || DEFAULT_CONFIG.username;
    this.dbPassword = config.password?.trim() || DEFAULT_CONFIG.password;

    this.dbUrl = `postgres://${this.dbUsername}:${this.dbPassword}@${this.dbHost}:${this.dbPort}/${this.dbName}`;
  }

  async promptMySql() {
    const config = await group({
      host: () => text({
        message: `Enter database host:`,
        placeholder: DEFAULT_CONFIG.host,
        validate: validateHostname,
      }),
      port: () => text({
        message: `Enter database port:`,
        placeholder: '3306',
        validate: validatePort,
      }),
      database: () => text({
        message: `Enter database name:`,
        placeholder: 'mysql',
      }),
      username: () => text({
        message: `Enter database username:`,
        placeholder: 'root',
      }),
      password: () => text({
        message: `Enter database password:`,
        placeholder: '',
      }),
    });

    this.dbType = 'mysql';
    this.dbHost = config.host?.trim() || DEFAULT_CONFIG.host;
    this.dbPort = config.port?.trim() ? Number(config.port) : 3306;
    this.dbName = config.database?.trim() || 'mysql';
    this.dbUsername = config.username?.trim() || 'root';
    this.dbPassword = config.password?.trim() || '';

    this.dbUrl = `mysql://${this.dbUsername}:${this.dbPassword}@${this.dbHost}:${this.dbPort}/${this.dbName}`;
  }

  async promptSqlite() {
    const config = await group({
      database: () => text({
        message: `Enter database file path:`,
        placeholder: './data.db',
      }),
    });

    this.dbType = 'sqlite';
    this.dbFilePath = config.database?.trim() || './data.db';
    this.dbUrl = `file:${this.dbFilePath}`;
  }

  async promptDBtype() {
    this.dbType = await select({
      message: 'Select your database type:',
      options: [
        { value: 'pg', label: 'PostgreSQL' },
        { value: 'mysql', label: 'MySQL' },
        { value: 'sqlite', label: 'SQLite (Better-Sqlite3)' },
      ],
    }) as DBtype;
  }

  async setupDB() {
    switch (this.dbType) {
      case 'pg':
        await this.promptPg();
        break;
      case 'mysql':
        await this.promptMySql();
        break;
      case 'sqlite':
        await this.promptSqlite();
        break;
      default:
        throw new Error(`Unsupported database type: ${this.dbType}`);
    }
  }

  async createNewConfig() {
    await this.setupDB();

    this.env.addComment('# Database Configuration');
    this.env.add('DB_TYPE', this.dbType, 'Database type');
    this.env.add('DB_URL', this.dbUrl, 'Database connection URL');
    this.env.addEmpty();

    if (this.dbType === 'pg') {
      this.env.addComment('# PostgreSQL Configuration Details');
      this.env.add('PG_HOST', this.dbHost, 'PostgreSQL host');
      this.env.add('PG_PORT', String(this.dbPort), 'PostgreSQL port');
      this.env.add('PG_DATABASE', this.dbName, 'PostgreSQL database name');
      this.env.add('PG_USER', this.dbUsername, 'PostgreSQL username');
      this.env.add('PG_PASSWORD', this.dbPassword, 'PostgreSQL password');
    }
    else if (this.dbType === 'mysql') {
      this.env.addComment('# MySQL Configuration Details');
      this.env.add('MYSQL_HOST', this.dbHost, 'MySQL host');
      this.env.add('MYSQL_PORT', String(this.dbPort), 'MySQL port');
      this.env.add('MYSQL_DATABASE', this.dbName, 'MySQL database name');
      this.env.add('MYSQL_USER', this.dbUsername, 'MySQL username');
      this.env.add('MYSQL_PASSWORD', this.dbPassword, 'MySQL password');
    }
    else if (this.dbType === 'sqlite') {
      this.env.addComment('# SQLite Configuration Details');
      this.env.add('SQLITE_FILE', this.dbFilePath, 'SQLite database file path');
    }
  }

  async setupDBEnv() {
    let configCreated = false;
    const existingDbType = this.env.get('DB_TYPE');
    const existingDbUrl = this.env.get('DB_URL');

    if (!this.env.has('DB_TYPE') || !this.env.has('DB_URL')) {
      log.info('Incomplete database configuration found. Creating new configuration...');
      await this.createNewConfig();
      configCreated = true;
    }

    else if (existingDbType !== this.dbType) {
      log.info(`Different database type found (${existingDbType} vs ${this.dbType}). Creating new configuration...`);
      await this.createNewConfig();
      configCreated = true;
    }

    else if (existingDbUrl) {
      log.info(`Existing ${this.dbType} configuration found:`);
      log.info(`DB_TYPE=${existingDbType}`);
      log.info(`DB_URL=${existingDbUrl}`);

      const shouldOverride = await confirm({
        message: 'Would you like to override the existing database configuration?',
        initialValue: false,
      });

      if (shouldOverride) {
        await this.createNewConfig();
        configCreated = true;
      } else {
        this.dbUrl = existingDbUrl;
      }
    }

    if (!configCreated && existingDbUrl) {
      this.dbUrl = existingDbUrl;
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