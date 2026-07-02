import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/enums/role.enum';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { StockService } from './stock.service';

@ApiTags('stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  @ApiOperation({ summary: 'Barcha stock balanslarini olish (Xom va Pishgan g\'isht)' })
  getAllStocks() {
    return this.stockService.getAllStocks();
  }

  @Get('movements')
  @ApiOperation({ summary: 'Stock harakatlar tarixini olish' })
  getMovements(@Query() paginationDto: PaginationDto) {
    return this.stockService.getMovements(paginationDto);
  }

  @Patch('adjust')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Stockni qo\'lda tuzatish (faqat Admin)' })
  adjustStock(
    @Body() adjustStockDto: AdjustStockDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.stockService.adjustStock(adjustStockDto, userId);
  }
}
