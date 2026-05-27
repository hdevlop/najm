import { Controller } from 'najm-api';
import { Delete, Get, Post, Put, ResMsg } from 'najm-api';
import { Body, Params, User } from 'najm-api';
import { McpTool, ToolGroup } from 'najm-mcp';
import { Validate } from 'najm-validation';
import { Policy, CanList, CanRead, CanCreate, CanUpdate, CanDelete, own, where } from 'najm-auth';
import { ProductService } from './ProductService';
import { productsTable } from './ProductSchema';
import {
  createProductDto,
  updateProductDto,
  productIdParam,
  productParam,
  resolveProductParam,
  productUpdateDto,
  type CreateProductDto,
  type UpdateProductDto,
  type ProductParamDto,
  type ProductUpdateDto,
} from './ProductDto';

const Product = own(productsTable)
  .for('user', where(productsTable.userId));

@ToolGroup('products')
@Policy(Product)
@Controller('/products')
export class ProductController {
  constructor(private productService: ProductService) {}

  @Get('/')
  @CanList()
  @McpTool({ description: 'List all products in the catalog', readOnly: true })
  @ResMsg('products.retrieved')
  async getAll() {
    return this.productService.getAll();
  }

  @Get('/my')
  @CanRead()
  @McpTool({ description: 'List products owned by the authenticated user', readOnly: true })
  @ResMsg('products.retrieved')
  async getMyProducts(@User('id') userId: string) {
    return this.productService.getByUserId(userId);
  }

  @Get('/:id')
  @CanRead()
  @McpTool({ description: 'Fetch one product by id', readOnly: true })
  @Validate({ params: productIdParam })
  @ResMsg('products.retrieved')
  async getById(@Params('id') id: string) {
    return this.productService.getById(id);
  }

  @Post('/')
  @CanCreate()
  @McpTool({ description: 'Create a new product for the authenticated user', idempotent: false, confirm: { level: 'warning', message: 'products.confirm.create' } })
  @Validate(createProductDto)
  @ResMsg({ message: 'products.createdSuccess', status: 201 })
  async create(@Body() body: CreateProductDto, @User('id') userId: string) {
    return this.productService.create({ ...body, userId });
  }

  @Put('/:id')
  @CanUpdate()
  @McpTool({ description: 'Update one of your products by ID', confirm: { level: 'warning', message: 'products.confirm.update' } })
  @Validate({ params: productIdParam, body: updateProductDto })
  @ResMsg('products.updated')
  async updateById(@Params('id') id: string, @Body() body: UpdateProductDto, @User('id') userId: string) {
    return this.productService.updateById(id, body, userId);
  }

  @Delete('/:id')
  @CanDelete()
  @McpTool({ description: 'Delete one of your products by ID', destructive: true, confirm: { level: 'danger', message: 'products.confirm.delete' } })
  @Validate({ params: productIdParam })
  @ResMsg('products.deleted')
  async deleteById(@Params('id') id: string, @User('id') userId: string) {
    await this.productService.deleteById(id, userId);
    return { deleted: true };
  }

  @Post('/resolve')
  @CanRead()
  @McpTool({
    description: 'Search and resolve one product by natural text, name, category, or ID. Use argument { product }, or aliases { name } / { id }. Returns the product when unique, or candidate matches when ambiguous.',
    readOnly: true,
  })
  @Validate(productParam)
  @ResMsg('products.retrieved')
  async get(@Body() body: ProductParamDto) {
    return this.productService.get(resolveProductParam(body));
  }

  @Post('/actions/update')
  @CanUpdate()
  @McpTool({
    description: 'Update a product by name, category, or ID. Use selector argument { product } or alias { id }, plus fields to update. Stops on ambiguity.',
    confirm: { level: 'warning', message: 'products.confirm.update' },
  })
  @Validate(productUpdateDto)
  @ResMsg('products.updated')
  async update(@Body() body: ProductUpdateDto) {
    const { product: _product, id: _id, ...patch } = body;
    return this.productService.update(resolveProductParam(body), patch as any);
  }

  @Post('/actions/delete')
  @CanDelete()
  @McpTool({
    description: 'Delete a product by name, category, or ID. Use argument { product }, or aliases { name } / { id }. Stops on ambiguity.',
    confirm: { level: 'danger', message: 'products.confirm.delete' },
  })
  @Validate(productParam)
  @ResMsg('products.deleted')
  async delete(@Body() body: ProductParamDto) {
    return this.productService.delete(resolveProductParam(body));
  }
}
