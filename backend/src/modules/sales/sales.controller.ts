import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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

  @Get('bank-transfer/firms')
  @ApiOperation({ summary: 'Get bank transfer firms summary' })
  getBankTransferFirms() {
    return this.salesService.getBankTransferFirms();
  }

  @Get('debt/firms')
  @ApiOperation({ summary: 'Get debt (nasiya) firms summary' })
  getDebtFirms() {
    return this.salesService.getDebtFirms();
  }

  @Get('firm-names')
  @ApiOperation({ summary: 'Get unique firm names for autocomplete' })
  getFirmNames() {
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
