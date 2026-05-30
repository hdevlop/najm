# najm-validation

Request validation plugin for Najm using Zod schemas. Provides `@Validate()` decorator for DTO-style validation.

## Install

```bash
bun add najm-validation
```

Requires peer dependency `zod`.

## Usage

### Define DTOs

```typescript
import { z } from 'zod';

export const createProductDto = z.object({
  name: z.string().min(2),
  price: z.number().positive(),
  category: z.string().optional(),
});

export const updateProductDto = createProductDto.partial();
export const productIdParam = z.object({ id: z.string().uuid() });

export type CreateProductDto = z.infer<typeof createProductDto>;
export type UpdateProductDto = z.infer<typeof updateProductDto>;
```

### Apply in Controllers

```typescript
import { Controller, Post, Patch, Get, Body, Params } from 'najm-core';
import { Validate } from 'najm-validation';

@Controller('/products')
class ProductController {
  @Post('/')
  @Validate(createProductDto)
  create(@Body() data: CreateProductDto) {
    return this.service.create(data);
  }

  @Patch('/:id')
  @Validate({ params: productIdParam, body: updateProductDto })
  update(@Params('id') id: string, @Body() data: UpdateProductDto) {
    return this.service.update(id, data);
  }

  @Get('/:id')
  @Validate({ params: productIdParam })
  getOne(@Params('id') id: string) {
    return this.service.findById(id);
  }
}
```

### Validation Modes

- `Validate(schema)` — validates body only
- `Validate({ body: schema, params: schema, query: schema })` — validates specific fields

Returns `400 Bad Request` with validation errors on failure.

## Production Notes

- DTOs are inferred with `z.infer<>` for full type safety
- Combine with `najm-auth` guards for authorization-aware validation
- For async validation (e.g., uniqueness checks), use Validator classes alongside DTOs