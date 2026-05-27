import { describe, test, expect, afterEach } from 'bun:test';
import { Err, Server } from 'najm-core';
import { Post, Get, Put } from 'najm-core';
import { Body, Params, Query, Headers } from 'najm-core';
import { validation } from '../src/ValidationPlugin';
import { Validate } from '../src/decorator';
import { z } from 'zod';
import { Controller } from 'najm-core';

let server: Server;
let currentPort = 3300;

const getPort = () => currentPort++;

afterEach(async () => {
  await server?.stop();
});

// ============================================================================
// SCHEMAS
// ============================================================================

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
});

const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(2).optional(),
});

const UserParamsSchema = z.object({
  id: z.string().uuid(),
});

const UserQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const HeadersSchema = z.object({
  'x-api-key': z.string().min(10),
});

// ============================================================================
// BASIC VALIDATION TESTS
// ============================================================================

describe('Validation Plugin - Basic', () => {
  test('should pass valid body data', async () => {
    const port = getPort();

    @Controller('/test')
    class TestController {
      @Post('/')
      @Validate(CreateUserSchema)
      create(@Body() data: any) {
        return { success: true, data };
      }
    }

    server = new Server({ isolated: true })
      .use(validation())
      .load(TestController);

    await server.listen(port);

    const res = await fetch(`http://localhost:${port}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        name: 'John Doe',
        password: 'SecurePass123',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.email).toBe('test@example.com');
  });

  test('should reject invalid email', async () => {
    const port = getPort();

    @Controller('/test')
    class TestController {
      @Post('/')
      @Validate(CreateUserSchema)
      create(@Body() data: any) {
        return data;
      }
    }

    server = new Server({ isolated: true })
      .use(validation())
      .load(TestController);

    await server.listen(port);

    const res = await fetch(`http://localhost:${port}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email',
        name: 'John',
        password: 'SecurePass123',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation Error');
    expect(body.target).toBe('body');
  });

  test('should reject short password', async () => {
    const port = getPort();

    @Controller('/test')
    class TestController {
      @Post('/')
      @Validate(CreateUserSchema)
      create(@Body() data: any) {
        return data;
      }
    }

    server = new Server({ isolated: true })
      .use(validation())
      .load(TestController);

    await server.listen(port);

    const res = await fetch(`http://localhost:${port}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        name: 'John',
        password: 'short',
      }),
    });

    expect(res.status).toBe(400);
  });

  test('should return validation issues in response', async () => {
    const port = getPort();

    @Controller('/test')
    class TestController {
      @Post('/')
      @Validate(CreateUserSchema)
      create(@Body() data: any) {
        return data;
      }
    }

    server = new Server({ isolated: true })
      .use(validation())
      .load(TestController);

    await server.listen(port);

    const res = await fetch(`http://localhost:${port}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid',
        name: 'J',
        password: 'short',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.issues).toBeDefined();
    expect(body.issues.length).toBeGreaterThan(0);
    expect(body.issues[0]).toHaveProperty('path');
    expect(body.issues[0]).toHaveProperty('message');
  });
});

// ============================================================================
// MULTIPLE TARGETS
// ============================================================================

describe('Validation Plugin - Multiple Targets', () => {
  test('should validate params and body', async () => {
    const port = getPort();

    @Controller('/users')
    class UserController {
      @Put('/:id')
      @Validate({
        params: UserParamsSchema,
        body: UpdateUserSchema,
      })
      update(@Params('id') id: string, @Body() data: any) {
        return { id, ...data };
      }
    }

    server = new Server({ isolated: true })
      .use(validation())
      .load(UserController);

    await server.listen(port);

    // Valid request
    const validRes = await fetch(
      `http://localhost:${port}/users/550e8400-e29b-41d4-a716-446655440000`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          name: 'Jane Doe',
        }),
      }
    );

    expect(validRes.status).toBe(200);

    // Invalid UUID
    const invalidRes = await fetch(`http://localhost:${port}/users/invalid-uuid`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        name: 'Jane Doe',
      }),
    });

    expect(invalidRes.status).toBe(400);
    const errorBody = await invalidRes.json();
    expect(errorBody.target).toBe('params');
  });

  test('should validate query parameters', async () => {
    const port = getPort();

    @Controller('/users')
    class UserController {
      @Get('/')
      @Validate({ query: UserQuerySchema })
      list(@Query() query: any) {
        return { query };
      }
    }

    server = new Server({ isolated: true })
      .use(validation())
      .load(UserController);

    await server.listen(port);

    // Valid query
    const validRes = await fetch(`http://localhost:${port}/users?page=2&limit=50`);
    expect(validRes.status).toBe(200);
    const validBody = await validRes.json();
    expect(validBody.query.page).toBe(2);
    expect(validBody.query.limit).toBe(50);

    // Invalid query (limit > 100)
    const invalidRes = await fetch(`http://localhost:${port}/users?page=1&limit=200`);
    expect(invalidRes.status).toBe(400);
    const errorBody = await invalidRes.json();
    expect(errorBody.target).toBe('query');
  });

  test('should validate headers', async () => {
    const port = getPort();

    @Controller('/api')
    class ApiController {
      @Post('/data')
      @Validate({ headers: HeadersSchema })
      create(@Body() data: any) {
        return { success: true };
      }
    }

    server = new Server({ isolated: true })
      .use(validation())
      .load(ApiController);

    await server.listen(port);

    // Valid headers
    const validRes = await fetch(`http://localhost:${port}/api/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': 'my-secret-api-key-123',
      },
      body: JSON.stringify({}),
    });
    expect(validRes.status).toBe(200);

    // Missing header
    const invalidRes = await fetch(`http://localhost:${port}/api/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(invalidRes.status).toBe(400);
    const errorBody = await invalidRes.json();
    expect(errorBody.target).toBe('headers');
  });

  test('should validate all targets together', async () => {
    const port = getPort();

    @Controller('/api')
    class FullController {
      @Put('/:id')
      @Validate({
        params: UserParamsSchema,
        query: z.object({ notify: z.coerce.boolean().optional() }),
        body: UpdateUserSchema,
      })
      update(
        @Params('id') id: string,
        @Query() query: any,
        @Body() data: any
      ) {
        return { id, query, data };
      }
    }

    server = new Server({ isolated: true })
      .use(validation())
      .load(FullController);

    await server.listen(port);

    const res = await fetch(
      `http://localhost:${port}/api/550e8400-e29b-41d4-a716-446655440000?notify=true`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Name' }),
      }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(body.query.notify).toBe(true);
    expect(body.data.name).toBe('Updated Name');
  });
});

// ============================================================================
// CUSTOM ERROR STATUS
// ============================================================================

describe('Validation Plugin - Custom Error Status', () => {
  test('should use custom error status from decorator', async () => {
    const port = getPort();

    @Controller('/test')
    class TestController {
      @Post('/')
      @Validate({
        body: CreateUserSchema,
        errorStatus: 422,
      })
      create(@Body() data: any) {
        return data;
      }
    }

    server = new Server({ isolated: true })
      .use(validation())
      .load(TestController);

    await server.listen(port);

    const res = await fetch(`http://localhost:${port}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid',
        name: 'John',
        password: 'SecurePass123',
      }),
    });

    expect(res.status).toBe(422);
  });

  test('should use global error status from plugin config', async () => {
    const port = getPort();

    @Controller('/test')
    class TestController {
      @Post('/')
      @Validate(CreateUserSchema)
      create(@Body() data: any) {
        return data;
      }
    }

    server = new Server({ isolated: true })
      .use(validation({ errorStatus: 422 }))
      .load(TestController);

    await server.listen(port);

    const res = await fetch(`http://localhost:${port}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid',
        name: 'John',
        password: 'SecurePass123',
      }),
    });

    expect(res.status).toBe(422);
  });

  test('should prefer decorator status over global status', async () => {
    const port = getPort();

    @Controller('/test')
    class TestController {
      @Post('/')
      @Validate({
        body: CreateUserSchema,
        errorStatus: 400, // Decorator overrides global
      })
      create(@Body() data: any) {
        return data;
      }
    }

    server = new Server({ isolated: true })
      .use(validation({ errorStatus: 422 }))
      .load(TestController);

    await server.listen(port);

    const res = await fetch(`http://localhost:${port}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid' }),
    });

    expect(res.status).toBe(400);
  });
});

// ============================================================================
// PLUGIN CONFIGURATION
// ============================================================================

describe('Validation Plugin - Configuration', () => {
  test('should disable validation when enabled=false', async () => {
    const port = getPort();

    @Controller('/test')
    class TestController {
      @Post('/')
      @Validate(CreateUserSchema)
      create(@Body() data: any) {
        return { success: true };
      }
    }

    server = new Server({ isolated: true })
      .use(validation({ enabled: false }))
      .load(TestController);

    await server.listen(port);

    // Should pass even with invalid data since validation is disabled
    const res = await fetch(`http://localhost:${port}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid',
        name: 'J',
        password: 'short',
      }),
    });

    expect(res.status).toBe(200);
  });

  test('should use custom error formatter', async () => {
    const port = getPort();

    @Controller('/test')
    class TestController {
      @Post('/')
      @Validate({
        body: CreateUserSchema,
        errorFormatter: (error:any, target) => ({
          customError: true,
          validationTarget: target,
          fieldErrors: error.issues.map((e: any) => e.path.join('.')),
        }),
      })
      create(@Body() data: any) {
        return data;
      }
    }

    server = new Server({ isolated: true })
      .use(validation())
      .load(TestController);

    await server.listen(port);

    const res = await fetch(`http://localhost:${port}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.customError).toBe(true);
    expect(body.validationTarget).toBe('body');
  });
});

// ============================================================================
// FILE UPLOAD (MULTIPART)
// ============================================================================

const UploadSchema = z.object({
  name: z.string().min(2),
  image: z.string().nullish(),
});

describe('Validation Plugin - File Upload (Multipart)', () => {
  test('should pass File through validation when schema has z.string().nullish()', async () => {
    const port = getPort();

    @Controller('/upload')
    class UploadController {
      @Post('/')
      @Validate(UploadSchema)
      upload(@Body() data: any) {
        return {
          success: true,
          name: data.name,
          imageIsFile: data.image instanceof File,
          imageFileName: data.image instanceof File ? data.image.name : null,
        };
      }
    }

    server = new Server({ isolated: true })
      .use(validation())
      .load(UploadController);

    await server.listen(port);

    const formData = new FormData();
    formData.append('name', 'Sara Idrissi');
    formData.append('image', new File(['fake-bytes'], 'avatar.png', { type: 'image/png' }));

    const res = await fetch(`http://localhost:${port}/upload`, {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.name).toBe('Sara Idrissi');
    expect(body.imageIsFile).toBe(true);
    expect(body.imageFileName).toBe('avatar.png');
  });

  test('should still validate non-file fields in multipart request', async () => {
    const port = getPort();

    @Controller('/upload')
    class UploadController {
      @Post('/')
      @Validate(UploadSchema)
      upload(@Body() data: any) {
        return data;
      }
    }

    server = new Server({ isolated: true })
      .use(validation())
      .load(UploadController);

    await server.listen(port);

    // name is too short — should still fail validation
    const formData = new FormData();
    formData.append('name', 'X');
    formData.append('image', new File(['bytes'], 'avatar.png', { type: 'image/png' }));

    const res = await fetch(`http://localhost:${port}/upload`, {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.target).toBe('body');
  });

  test('should accept string image (MCP / JSON path)', async () => {
    const port = getPort();

    @Controller('/upload')
    class UploadController {
      @Post('/')
      @Validate(UploadSchema)
      upload(@Body() data: any) {
        return { success: true, image: data.image };
      }
    }

    server = new Server({ isolated: true })
      .use(validation())
      .load(UploadController);

    await server.listen(port);

    const res = await fetch(`http://localhost:${port}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sara Idrissi', image: '/api/storage/avatar.png' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.image).toBe('/api/storage/avatar.png');
  });

  test('should accept missing image field (nullish allows undefined)', async () => {
    const port = getPort();

    @Controller('/upload')
    class UploadController {
      @Post('/')
      @Validate(UploadSchema)
      upload(@Body() data: any) {
        return { success: true };
      }
    }

    server = new Server({ isolated: true })
      .use(validation())
      .load(UploadController);

    await server.listen(port);

    const res = await fetch(`http://localhost:${port}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sara Idrissi' }),
    });

    expect(res.status).toBe(200);
  });

  test('should pass multiple File fields through validation', async () => {
    const port = getPort();

    const MultiUploadSchema = z.object({
      title: z.string().min(1),
      thumbnail: z.string().nullish(),
      banner: z.string().nullish(),
    });

    @Controller('/upload')
    class UploadController {
      @Post('/multi')
      @Validate(MultiUploadSchema)
      upload(@Body() data: any) {
        return {
          success: true,
          thumbnailIsFile: data.thumbnail instanceof File,
          bannerIsFile: data.banner instanceof File,
          title: data.title,
        };
      }
    }

    server = new Server({ isolated: true })
      .use(validation())
      .load(UploadController);

    await server.listen(port);

    const formData = new FormData();
    formData.append('title', 'Course Cover');
    formData.append('thumbnail', new File(['t'], 'thumb.png', { type: 'image/png' }));
    formData.append('banner', new File(['b'], 'banner.jpg', { type: 'image/jpeg' }));

    const res = await fetch(`http://localhost:${port}/upload/multi`, {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.thumbnailIsFile).toBe(true);
    expect(body.bannerIsFile).toBe(true);
    expect(body.title).toBe('Course Cover');
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Validation Plugin - Edge Cases', () => {
  test('should handle missing body gracefully', async () => {
    const port = getPort();

    @Controller('/test')
    class TestController {
      @Post('/')
      @Validate(CreateUserSchema)
      create(@Body() data: any) {
        return data;
      }
    }

    server = new Server({ isolated: true })
      .use(validation())
      .load(TestController);

    await server.listen(port);

    const res = await fetch(`http://localhost:${port}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
  });

  test('should handle empty body', async () => {
    const port = getPort();

    @Controller('/test')
    class TestController {
      @Post('/')
      @Validate(CreateUserSchema)
      create(@Body() data: any) {
        return data;
      }
    }

    server = new Server({ isolated: true })
      .use(validation())
      .load(TestController);

    await server.listen(port);

    const res = await fetch(`http://localhost:${port}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  test('should handle default values in schema', async () => {
    const port = getPort();

    const SchemaWithDefaults = z.object({
      name: z.string(),
      role: z.string().default('user'),
      active: z.boolean().default(true),
    });

    @Controller('/test')
    class TestController {
      @Post('/')
      @Validate(SchemaWithDefaults)
      create(@Body() data: any) {
        return data;
      }
    }

    server = new Server({ isolated: true })
      .use(validation())
      .load(TestController);

    await server.listen(port);

    const res = await fetch(`http://localhost:${port}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User' }),
    });

    expect(res.status).toBe(200);
  });

  test('should handle coercion in query params', async () => {
    const port = getPort();

    const QuerySchema = z.object({
      page: z.coerce.number(),
      active: z.coerce.boolean(),
    });

    @Controller('/test')
    class TestController {
      @Get('/')
      @Validate({ query: QuerySchema })
      list(@Query() query: any) {
        return {
          page: query.page,
          pageType: typeof query.page,
          active: query.active,
          activeType: typeof query.active,
        };
      }
    }

    server = new Server({ isolated: true })
      .use(validation())
      .load(TestController);

    await server.listen(port);

    const res = await fetch(`http://localhost:${port}/test?page=5&active=true`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toBe(5);
    expect(body.pageType).toBe('number');
    expect(body.active).toBe(true);
    expect(body.activeType).toBe('boolean');
  });

  test('should work without validation decorator', async () => {
    const port = getPort();

    @Controller('/test')
    class TestController {
      @Post('/')
      create(@Body() data: any) {
        return { received: data };
      }
    }

    server = new Server({ isolated: true })
      .use(validation())
      .load(TestController);

    await server.listen(port);

    const res = await fetch(`http://localhost:${port}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anything: 'goes' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received.anything).toBe('goes');
  });
});



