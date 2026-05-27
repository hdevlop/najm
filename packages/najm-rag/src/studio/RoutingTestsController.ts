import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Params,
  Query,
  Inject,
  Req,
  User,
  HttpError,
} from 'najm-core';
import { Validate } from 'najm-validation';
import { z } from 'zod';
import { isAdmin } from 'najm-auth';
import { McpTool, ToolGroup } from 'najm-mcp';
import { RoutingTestsService } from '../routingTests';
import {
  createRoutingTestDto,
  updateRoutingTestDto,
  importRoutingTestsDto,
  routingTestIdParam,
  type CreateRoutingTestDto,
  type UpdateRoutingTestDto,
  type ImportRoutingTestsDto,
} from '../routingTests';
import { StudioAuditService } from './StudioAuditService';

const idsBatchDto = z.object({ ids: z.array(z.string().min(1)).min(1) });

@Controller('/rag-studio')
@ToolGroup('rag_studio')
@isAdmin()
export class RoutingTestsController {
  @Inject() private routingTests!: RoutingTestsService;
  @Inject() private audit!: StudioAuditService;

  @Get('/routing-tests')
  @McpTool('List persisted routing tests. Supports limit/offset pagination and search/status filters; returns { items, total, limit, offset } when limit or offset is provided, otherwise the full array')
  async listRoutingTests(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    if (limit !== undefined || offset !== undefined || search !== undefined || status !== undefined) {
      const parsedLimit = limit ? Number(limit) : undefined;
      const parsedOffset = offset ? Number(offset) : undefined;
      return this.routingTests.listPaginated({
        limit: parsedLimit != null && Number.isFinite(parsedLimit) ? parsedLimit : undefined,
        offset: parsedOffset != null && Number.isFinite(parsedOffset) ? parsedOffset : undefined,
        search,
        status,
      });
    }
    return this.routingTests.list();
  }

  @Get('/routing-tests/export')
  @McpTool('Export all routing tests as a portable JSON payload')
  async exportRoutingTests() {
    return this.routingTests.export();
  }

  @Get('/routing-tests/:id')
  @McpTool('Get a single routing test by id with its last run result')
  @Validate({ params: routingTestIdParam })
  async getRoutingTest(@Params('id') id: string) {
    const test = await this.routingTests.getById(id);
    if (!test) HttpError.notFound(`Routing test not found: ${id}`);
    return test;
  }

  @Post('/routing-tests')
  @McpTool('Create a routing test case (name, query, expectedTools[]) — last run status starts as pending')
  @Validate(createRoutingTestDto)
  async createRoutingTest(@Body() body: CreateRoutingTestDto, @User() user: any) {
    const result = await this.routingTests.create(body);
    await this.audit.recordAudit('create_routing_test', `name=${body.name}`, user?.id ?? null);
    return result;
  }

  @Post('/routing-tests/run-all')
  @McpTool('Run every persisted routing test against the current router and persist results')
  async runAllRoutingTests(@User() user: any) {
    const results = await this.routingTests.runAll();
    await this.audit.recordAudit('run_routing_tests', `count=${results.length}`, user?.id ?? null);
    return results;
  }

  @Post('/routing-tests/import')
  @McpTool('Bulk import routing tests. mode "append" adds, "replace" wipes existing first')
  @Validate(importRoutingTestsDto)
  async importRoutingTests(@Body() body: ImportRoutingTestsDto, @User() user: any) {
    const result = await this.routingTests.import(body);
    await this.audit.recordAudit('import_routing_tests', `mode=${body.mode ?? 'append'} count=${result.imported}`, user?.id ?? null);
    return result;
  }

  @Post('/routing-tests/import-jobs')
  async createRoutingTestsImportJob(@Req() req: any, @User() user: any) {
    const contentType = req.raw.headers.get('content-type') ?? '';
    const files: Array<{ name: string; tests: Array<{ name: string; query: string; expectedTools: string[] }> }> = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const fileEntries = formData.getAll('files');
      if (fileEntries.length === 0) {
        const single = formData.get('file');
        if (single && typeof single === 'object' && 'text' in single) fileEntries.push(single);
      }
      for (const entry of fileEntries) {
        if (typeof entry === 'object' && 'text' in entry) {
          const file = entry as File;
          const raw = await file.text();
          files.push(this.routingTests.parseRoutingTestsFile(file.name, raw));
        }
      }
    } else {
      const body = await req.json();
      files.push(this.routingTests.parseRoutingTestsFile('import.json', JSON.stringify(body)));
    }

    if (files.length === 0) HttpError.badRequest('No files provided for import');

    const job = await this.routingTests.createImportJob(files);
    const totalTests = files.reduce((sum, f) => sum + f.tests.length, 0);
    await this.audit.recordAudit('create_routing_tests_import_job', `jobId=${job.jobId} files=${files.length} tests=${totalTests}`, user?.id ?? null);
    return job;
  }

  @Get('/routing-tests/import-jobs/:jobId')
  async getRoutingTestsImportJob(@Params('jobId') jobId: string) {
    const job = this.routingTests.getImportJob(jobId);
    if (!job) HttpError.notFound(`Routing tests import job not found: ${jobId}`);
    return job;
  }

  @Patch('/routing-tests/:id')
  @McpTool('Update a routing test. Changing query or expectedTools resets its last run status to pending')
  @Validate({ params: routingTestIdParam, body: updateRoutingTestDto })
  async updateRoutingTest(@Params('id') id: string, @Body() body: UpdateRoutingTestDto, @User() user: any) {
    const result = await this.routingTests.update(id, body);
    if (!result) HttpError.notFound(`Routing test not found: ${id}`);
    await this.audit.recordAudit('update_routing_test', `id=${id}`, user?.id ?? null);
    return result;
  }

  @Post('/routing-tests/:id/run')
  @McpTool('Run a single routing test by id and persist the result')
  @Validate({ params: routingTestIdParam })
  async runRoutingTest(@Params('id') id: string, @User() user: any) {
    const result = await this.routingTests.runOne(id);
    if (!result) HttpError.notFound(`Routing test not found: ${id}`);
    await this.audit.recordAudit('run_routing_test', `id=${id} status=${result.lastStatus}`, user?.id ?? null);
    return result;
  }

  @Post('/routing-tests/delete-batch')
  @McpTool('Delete a batch of routing tests by id (bulk delete).')
  @Validate(idsBatchDto)
  async deleteRoutingTestsBatch(@Body() body: { ids: string[] }, @User() user: any) {
    const result = await this.routingTests.deleteMany(body.ids);
    await this.audit.recordAudit('delete_routing_tests_batch', `count=${result.deleted}`, user?.id ?? null);
    return result;
  }

  @Delete('/routing-tests')
  @McpTool('Delete all routing tests')
  async deleteAllRoutingTests(@User() user: any) {
    const result = await this.routingTests.deleteAll();
    await this.audit.recordAudit('delete_all_routing_tests', `deleted=${result.deleted}`, user?.id ?? null);
    return result;
  }

  @Delete('/routing-tests/:id')
  @McpTool('Delete a single routing test by id')
  @Validate({ params: routingTestIdParam })
  async deleteRoutingTest(@Params('id') id: string, @User() user: any) {
    await this.routingTests.delete(id);
    await this.audit.recordAudit('delete_routing_test', `id=${id}`, user?.id ?? null);
    return { deleted: true };
  }
}
