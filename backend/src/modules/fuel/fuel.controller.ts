import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateFuelExpenseDto } from './dto/create-fuel-expense.dto';
import { CreateFuelIncomeDto } from './dto/create-fuel-income.dto';
import { FuelQueryDto } from './dto/fuel-query.dto';
import { FuelService } from './fuel.service';

@ApiTags('fuel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fuel')
export class FuelController {
  constructor(private readonly fuelService: FuelService) {}

  @Post('incomes')
  @ApiOperation({ summary: 'Salyarka kirimi qo\'shish' })
  createIncome(@Body() dto: CreateFuelIncomeDto, @CurrentUser('id') userId: string) {
    return this.fuelService.createIncome(dto, userId);
  }

  @Get('incomes')
  @ApiOperation({ summary: 'Salyarka kirimlari ro\'yxati' })
  findAllIncomes(@Query() query: FuelQueryDto) {
    return this.fuelService.findAllIncomes(query);
  }

  @Delete('incomes/:id')
  @ApiOperation({ summary: 'Salyarka kirimini o\'chirish' })
  removeIncome(@Param('id') id: string) {
    return this.fuelService.removeIncome(id);
  }

  @Post('expenses')
  @ApiOperation({ summary: 'Salyarka rasxodi qo\'shish' })
  createExpense(@Body() dto: CreateFuelExpenseDto, @CurrentUser('id') userId: string) {
    return this.fuelService.createExpense(dto, userId);
  }

  @Get('expenses')
  @ApiOperation({ summary: 'Salyarka rasxodlari ro\'yxati' })
  findAllExpenses(@Query() query: FuelQueryDto) {
    return this.fuelService.findAllExpenses(query);
  }

  @Delete('expenses/:id')
  @ApiOperation({ summary: 'Salyarka rasxodini o\'chirish' })
  removeExpense(@Param('id') id: string) {
    return this.fuelService.removeExpense(id);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Hozirgi salyarka qoldig\'i (litr)' })
  getBalance() {
    return this.fuelService.getCurrentBalance().then((balance) => ({ balance }));
  }

  @Get('ledger')
  @ApiOperation({ summary: 'Kunlik salyarka holati (kirim/rasxod/qolgan)' })
  getDailyLedger(@Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    return this.fuelService.getDailyLedger(dateFrom, dateTo);
  }
}
