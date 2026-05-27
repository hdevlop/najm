import { Body, Controller, Get, Post } from 'najm-api';
import { McpTool, ToolGroup } from 'najm-mcp';
import { Validate } from 'najm-validation';
import { calculateFeeDto, type CalculateFeeDto } from './FeeDto';
import { FeeService } from './FeeService';

@ToolGroup('fees')
@Controller('/fees')
export class FeeController {
  constructor(private feeService: FeeService) {}

  @Get('/test')
  @McpTool({ description: 'Check that the fee module is loaded and ready for MCP calls', readOnly: true })
  test() {
    return this.feeService.testConnection();
  }

  @Post('/calculate')
  @McpTool({ description: 'Calculate a processing fee using percentage and flat-fee inputs', idempotent: false })
  @Validate(calculateFeeDto)
  calculate(@Body() body: CalculateFeeDto) {
    return this.feeService.calculate(body);
  }
}
