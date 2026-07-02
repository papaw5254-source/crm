import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/enums/role.enum';
import { DateRangeDto, DailyReportDto, MonthlyReportDto, YearlyReportDto } from './dto/report-filter.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Asosiy dashboard ma\'lumotlari' })
  getDashboard() {
    return this.reportsService.getDashboard();
  }

  @Get('daily')
  @ApiOperation({ summary: 'Kunlik hisobot' })
  getDailyReport(@Query() query: DailyReportDto) {
    return this.reportsService.getDailyReport(query);
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Oylik hisobot' })
  getMonthlyReport(@Query() query: MonthlyReportDto) {
    return this.reportsService.getMonthlyReport(query);
  }

  @Get('yearly')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Yillik hisobot (Admin only)' })
  getYearlyReport(@Query() query: YearlyReportDto) {
    return this.reportsService.getYearlyReport(query);
  }

  @Get('inventory')
  @ApiOperation({ summary: 'Ombor hisoboti' })
  getInventoryReport(@Query() query: DateRangeDto) {
    return this.reportsService.getInventoryReport(query);
  }

  @Get('stock')
  @ApiOperation({ summary: 'Stock balans hisoboti (Xom va Pishgan g\'isht + Zaxira)' })
  getStockReport() {
    return this.reportsService.getStockReport();
  }

  @Get('debts')
  @ApiOperation({ summary: 'Qarzdorlar hisoboti (mijozlar + ishchilar)' })
  getDebtReport() {
    return this.reportsService.getDebtReport();
  }

  @Get('cashflow')
  @ApiOperation({ summary: 'Naqd pul oqimi hisoboti' })
  getCashflowReport(@Query() query: DateRangeDto) {
    return this.reportsService.getCashflowReport(query);
  }

  @Get('excel-style')
  @ApiOperation({ summary: 'Excel uslubidagi to\'liq kunlik hisobot' })
  getExcelStyleReport(@Query() query: DailyReportDto) {
    return this.reportsService.getExcelStyleReport(query);
  }

  @Get('expenses')
  @ApiOperation({ summary: 'Xarajatlar hisoboti' })
  getExpenseReport(@Query() query: DateRangeDto) {
    return this.reportsService.getExpenseReport(query);
  }

  @Get('sales')
  @ApiOperation({ summary: 'Savdo hisoboti' })
  getSalesReport(@Query() query: DateRangeDto) {
    return this.reportsService.getSalesReport(query);
  }
}
