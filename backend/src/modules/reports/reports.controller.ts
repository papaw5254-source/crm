import { Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/enums/role.enum';
import { DateRangeDto, DailyReportDto, MonthlyReportDto, YearlyReportDto } from './dto/report-filter.dto';
import { ReportsExcelService } from './reports-excel.service';
import { ReportsService } from './reports.service';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportsExcelService: ReportsExcelService,
  ) {}

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

  @Get('daily/excel')
  @ApiOperation({ summary: "Kunlik hisobotni Excel (.xlsx) formatida yuklab olish" })
  async downloadDailyExcel(@Query() query: DailyReportDto, @Res() res: Response) {
    const date = query.date || new Date().toISOString().split('T')[0];
    const buffer = await this.reportsExcelService.generateDailyExcel(date);
    res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
    res.setHeader('Content-Disposition', `attachment; filename="kunlik-hisobot-${date}.xlsx"`);
    res.send(buffer);
  }

  @Get('monthly/excel')
  @ApiOperation({ summary: "Oylik hisobotni Excel (.xlsx) formatida yuklab olish" })
  async downloadMonthlyExcel(@Query() query: MonthlyReportDto, @Res() res: Response) {
    const now = new Date();
    const year = query.year || now.getFullYear();
    const month = query.month || now.getMonth() + 1;
    const buffer = await this.reportsExcelService.generateMonthlyExcel(year, month);
    res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
    res.setHeader('Content-Disposition', `attachment; filename="oylik-hisobot-${year}-${String(month).padStart(2, '0')}.xlsx"`);
    res.send(buffer);
  }

  @Get('yearly/excel')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Yillik hisobotni Excel (.xlsx) formatida yuklab olish (Admin only)' })
  async downloadYearlyExcel(@Query() query: YearlyReportDto, @Res() res: Response) {
    const year = query.year || new Date().getFullYear();
    const buffer = await this.reportsExcelService.generateYearlyExcel(year);
    res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
    res.setHeader('Content-Disposition', `attachment; filename="yillik-hisobot-${year}.xlsx"`);
    res.send(buffer);
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

  @Post('admin/reset-data')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Barcha ma\'lumotlarni tozalash (Admin only)' })
  resetAllData() {
    return this.reportsService.resetAllData();
  }
}
