import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaymentType } from '../../common/enums/payment-type.enum';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/enums/role.enum';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesQueryDto } from './dto/sales-query.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { SalesService } from './sales.service';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new sale (Chiqim)' })
  create(@Body() createDto: CreateSaleDto, @CurrentUser('id') userId: string) {
    return this.salesService.create(createDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all sales' })
  findAll(@Query() paginationDto: SalesQueryDto) {
    return this.salesService.findAll(paginationDto);
  }

  @Get('regular')
  @ApiOperation({ summary: 'Get only main sales, excluding reserve sales' })
  findRegular(@Query() paginationDto: SalesQueryDto) {
    return this.salesService.findAll({ ...paginationDto, isReserveSale: false });
  }

  @Get('bank-transfer/firms')
  @ApiOperation({ summary: 'Get bank transfer firms summary' })
  getBankTransferFirms() {
    return this.salesService.getBankTransferFirms();
  }

  @Get('firms/bank-transfer')
  @ApiOperation({ summary: 'Get bank transfer firms summary (legacy route)' })
  getBankTransferFirmsLegacy() {
    return this.salesService.getBankTransferFirms();
  }

  @Get('debt/firms')
  @ApiOperation({ summary: 'Get debt (nasiya) firms summary' })
  getDebtFirms() {
    return this.salesService.getDebtFirms();
  }

  @Get('firms/debt')
  @ApiOperation({ summary: 'Get debt (nasiya) firms summary (legacy route)' })
  getDebtFirmsLegacy() {
    return this.salesService.getDebtFirms();
  }

  @Get('firm-names')
  @ApiOperation({ summary: 'Get unique firm names for autocomplete' })
  getFirmNames() {
    return this.salesService.getFirmNames();
  }

  @Get('firm-sales')
  @ApiOperation({ summary: 'Get individual sales for a specific firm' })
  async getFirmSales(
    @Query('firmName') firmName: string,
    @Query('paymentType') paymentType: PaymentType,
  ) {
    try {
      return await this.salesService.getFirmSales(firmName, paymentType);
    } catch (e) {
      throw new HttpException({ message: (e as Error).message, stack: (e as Error).stack }, 500);
    }
  }

  @Get('firms')
  @ApiOperation({ summary: 'Get unique firm names for autocomplete (legacy route)' })
  getFirmNamesLegacy() {
    return this.salesService.getFirmNames();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sale by id' })
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update sale' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateSaleDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.salesService.update(id, updateDto, userId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete sale (Admin only)' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.salesService.remove(id, userId);
  }
}
