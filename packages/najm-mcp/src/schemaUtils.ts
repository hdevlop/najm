export function getSchemaShape(schema: any): Record<string, unknown> | undefined {
  if (!schema) return undefined;

  const seen = new Set<any>();
  const unwrap = (candidate: any): Record<string, unknown> | undefined => {
    if (!candidate || seen.has(candidate)) return undefined;
    seen.add(candidate);

    const innerCandidates = [
      candidate._def?.schema,
      candidate._def?.innerType,
      candidate._def?.in,
      candidate._def?.out,
      candidate._zod?.def?.schema,
      candidate._zod?.def?.innerType,
      candidate._zod?.def?.in,
      candidate._zod?.def?.out,
    ];

    for (const inner of innerCandidates) {
      const shape = getSchemaShape(inner);
      if (shape) return shape;
    }

    return undefined;
  };

  if (typeof schema.shape === 'function') {
    const shape = schema.shape();
    if (shape && typeof shape === 'object') return shape;
  }

  if (schema.shape && typeof schema.shape === 'object') {
    return schema.shape;
  }

  if (schema._def) {
    if (typeof schema._def.shape === 'function') {
      const shape = schema._def.shape();
      if (shape && typeof shape === 'object') return shape;
    }

    if (schema._def.shape && typeof schema._def.shape === 'object') {
      return schema._def.shape;
    }
  }

  if (schema._zod?.def) {
    if (typeof schema._zod.def.shape === 'function') {
      const shape = schema._zod.def.shape();
      if (shape && typeof shape === 'object') return shape;
    }

    if (schema._zod.def.shape && typeof schema._zod.def.shape === 'object') {
      return schema._zod.def.shape;
    }
  }

  return unwrap(schema);
}
