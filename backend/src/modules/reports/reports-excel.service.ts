import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ReportsService } from './reports.service';

const TITLE_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
const SECTION_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFBFBF' } };
const HIGHLIGHT_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
const NUM_FMT = '#,##0" so\'m"';
const QTY_FMT = '#,##0" dona"';
const LAST_COL = 5;

@Injectable()
export class ReportsExcelService {
  constructor(private readonly reportsService: ReportsService) {}

  private addTitle(sheet: ExcelJS.Worksheet, text: string) {
    const row = sheet.addRow([text]);
    sheet.mergeCells(row.number, 1, row.number, LAST_COL);
    row.getCell(1).font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    row.getCell(1).fill = TITLE_FILL;
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.height = 28;
    sheet.addRow([]);
  }

  private addSection(sheet: ExcelJS.Worksheet, text: string) {
    const row = sheet.addRow([text]);
    sheet.mergeCells(row.number, 1, row.number, LAST_COL);
    row.getCell(1).font = { bold: true, size: 12 };
    row.getCell(1).fill = SECTION_FILL;
    row.height = 20;
  }

  private addKV(sheet: ExcelJS.Worksheet, label: string, value: number, fmt: string, highlight = false) {
    const row = sheet.addRow([label, value]);
    row.getCell(2).numFmt = fmt;
    row.getCell(2).alignment = { horizontal: 'right' };
    if (highlight) {
      row.getCell(1).font = { bold: true };
      row.getCell(2).font = { bold: true };
      row.getCell(1).fill = HIGHLIGHT_FILL;
      row.getCell(2).fill = HIGHLIGHT_FILL;
    }
  }

  private addSpacer(sheet: ExcelJS.Worksheet) {
    sheet.addRow([]);
  }

  private addTableHeader(sheet: ExcelJS.Worksheet, headers: string[]) {
    const row = sheet.addRow(headers);
    row.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = HEADER_FILL;
    });
  }

  private setColumnWidths(sheet: ExcelJS.Worksheet, widths: number[]) {
    widths.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });
  }

  private addDebtorsSection(sheet: ExcelJS.Worksheet, unpaidDebtors: any[]) {
    this.addSection(sheet, "QARZDORLAR (faol)");
    this.addTableHeader(sheet, ["Ism", 'Telefon', 'Jami qarz', "To'langan", 'Qolgan qarz']);
    let totalDebt = 0, totalPaid = 0, totalRemaining = 0;
    for (const d of unpaidDebtors) {
      const row = sheet.addRow([
        d.fullName || '—',
        d.phone || '—',
        Number(d.totalDebt) || 0,
        Number(d.paidAmount) || 0,
        Number(d.remainingDebt) || 0,
      ]);
      row.getCell(3).numFmt = NUM_FMT;
      row.getCell(4).numFmt = NUM_FMT;
      row.getCell(5).numFmt = NUM_FMT;
      totalDebt += Number(d.totalDebt) || 0;
      totalPaid += Number(d.paidAmount) || 0;
      totalRemaining += Number(d.remainingDebt) || 0;
    }
    if (unpaidDebtors.length === 0) {
      sheet.addRow(["Faol qarzdorlar yo'q"]);
    } else {
      const totalRow = sheet.addRow(['JAMI', '', totalDebt, totalPaid, totalRemaining]);
      totalRow.eachCell((cell) => { cell.font = { bold: true }; });
      totalRow.getCell(3).numFmt = NUM_FMT;
      totalRow.getCell(4).numFmt = NUM_FMT;
      totalRow.getCell(5).numFmt = NUM_FMT;
    }
  }

  async generateDailyExcel(date: string): Promise<Buffer> {
    const [report, debts] = await Promise.all([
      this.reportsService.getDailyReport({ date }),
      this.reportsService.getDebtReport(),
    ]);

    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Kunlik hisobot');
    this.setColumnWidths(sheet, [32, 18, 18, 18, 18]);

    this.addTitle(sheet, `KUNLIK HISOBOT — ${date}`);

    this.addSection(sheet, 'ISHLAB CHIQARISH');
    this.addKV(sheet, "Xom g'isht ishlab chiqarildi", report.rawBrickProduced, QTY_FMT);
    this.addKV(sheet, "Pishgan g'isht chiqdi (humbuz)", report.bakedBrickProduced, QTY_FMT);
    this.addKV(sheet, "Xom g'isht sotildi", report.rawBrickSold, QTY_FMT);
    this.addKV(sheet, "Pishgan g'isht sotildi", report.bakedBrickSold, QTY_FMT);
    this.addKV(sheet, "Zaxira sotuvidan g'isht sotildi", report.reserveSoldBricks, QTY_FMT);
    this.addKV(sheet, "Zalog g'ishti yetkazildi", report.prepaymentDeliveredBricks, QTY_FMT);
    this.addSpacer(sheet);

    this.addSection(sheet, 'MOLIYA');
    this.addKV(sheet, 'Jami sotuv', report.totalSalesAmount, NUM_FMT);
    this.addKV(sheet, 'Naqd sotuvlar', report.cashSales, NUM_FMT);
    this.addKV(sheet, 'Karta sotuvlar', report.cardSales, NUM_FMT);
    this.addKV(sheet, 'Perechisleniya', report.bankTransferSales, NUM_FMT);
    this.addKV(sheet, 'Nasiya sotuvlar', report.debtSalesAmount, NUM_FMT);
    this.addKV(sheet, "Qarz to'lovlari", report.debtPayments, NUM_FMT);
    this.addKV(sheet, 'Zalog puli', report.prepaymentPaid, NUM_FMT);
    this.addKV(sheet, 'Pul kirimlari', report.moneyIncomes, NUM_FMT);
    this.addKV(sheet, 'Naqd tushum', report.receivedCash, NUM_FMT);
    this.addKV(sheet, 'Xarajatlar', report.totalExpenses, NUM_FMT);
    this.addKV(sheet, 'Ishchi puli (hisoblangan)', report.workerAccrued, NUM_FMT);
    this.addKV(sheet, "Ishchi puli (to'langan)", report.workerPayments, NUM_FMT);
    this.addKV(sheet, 'Sof foyda', report.netProfit, NUM_FMT);
    this.addKV(sheet, 'Kun oxiriga qolgan pul', report.endOfDayBalance, NUM_FMT, true);
    this.addSpacer(sheet);

    this.addDebtorsSection(sheet, debts.unpaidDebtors);

    return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  async generateMonthlyExcel(year: number, month: number): Promise<Buffer> {
    const [report, debts] = await Promise.all([
      this.reportsService.getMonthlyReport({ year, month }),
      this.reportsService.getDebtReport(),
    ]);

    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Oylik hisobot');
    this.setColumnWidths(sheet, [32, 18, 18, 18, 18]);

    this.addTitle(sheet, `OYLIK HISOBOT — ${report.year}-yil ${String(report.month).padStart(2, '0')}-oy`);

    this.addSection(sheet, 'ISHLAB CHIQARISH');
    this.addKV(sheet, "Ishlab chiqarilgan g'isht", report.totalAddedBricks, QTY_FMT);
    this.addKV(sheet, "Sotilgan g'isht", report.totalSoldBricks, QTY_FMT);
    this.addKV(sheet, "Zaxira sotuvidan g'isht sotildi", report.reserveSoldBricks, QTY_FMT);
    this.addKV(sheet, "Zalog g'ishti yetkazildi", report.prepaymentDeliveredBricks, QTY_FMT);
    this.addSpacer(sheet);

    this.addSection(sheet, 'MOLIYA');
    this.addKV(sheet, "Jami sotuv (qog'oz)", report.totalSalesAmount, NUM_FMT);
    this.addKV(sheet, 'Nasiya sotuvlar', report.debtSalesAmount, NUM_FMT);
    this.addKV(sheet, 'Zalog puli', report.prepaymentPaid, NUM_FMT);
    this.addKV(sheet, 'Pul kirimlari', report.moneyIncomes, NUM_FMT);
    this.addKV(sheet, 'Naqd tushum', report.cashReceived, NUM_FMT);
    this.addKV(sheet, 'Xarajatlar', report.totalExpenses, NUM_FMT);
    this.addKV(sheet, 'Ishchi puli (hisoblangan)', report.workerAccrued, NUM_FMT);
    this.addKV(sheet, "Ishchi puli (to'langan)", report.workerPaid, NUM_FMT);
    this.addKV(sheet, 'Sof foyda', report.netProfit, NUM_FMT);
    this.addKV(sheet, 'Kun oxiriga qolgan pul', report.endOfDayBalance, NUM_FMT, true);
    this.addSpacer(sheet);

    this.addDebtorsSection(sheet, debts.unpaidDebtors);
    this.addSpacer(sheet);

    this.addSection(sheet, "KUNLAR BO'YICHA");
    this.addTableHeader(sheet, ['Sana', 'Sotuv', 'Xarajat', 'Ishchi puli', 'Kun oxiriga qolgan pul']);
    for (const [day, d] of Object.entries(report.groupedByDay) as [string, any][]) {
      const row = sheet.addRow([day, d.salesAmount, d.expenses, d.workerAccrued, d.endOfDayBalance]);
      row.getCell(2).numFmt = NUM_FMT;
      row.getCell(3).numFmt = NUM_FMT;
      row.getCell(4).numFmt = NUM_FMT;
      row.getCell(5).numFmt = NUM_FMT;
    }

    return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  async generateYearlyExcel(year: number): Promise<Buffer> {
    const [report, debts] = await Promise.all([
      this.reportsService.getYearlyReport({ year }),
      this.reportsService.getDebtReport(),
    ]);

    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Yillik hisobot');
    this.setColumnWidths(sheet, [32, 18, 18, 18, 18]);

    this.addTitle(sheet, `YILLIK HISOBOT — ${report.year}-yil`);

    this.addSection(sheet, 'ISHLAB CHIQARISH');
    this.addKV(sheet, "Ishlab chiqarilgan g'isht", report.totalAddedBricks, QTY_FMT);
    this.addKV(sheet, "Sotilgan g'isht", report.totalSoldBricks, QTY_FMT);
    this.addKV(sheet, "Zaxira sotuvidan g'isht sotildi", report.reserveSoldBricks, QTY_FMT);
    this.addKV(sheet, "Zalog g'ishti yetkazildi", report.prepaymentDeliveredBricks, QTY_FMT);
    this.addSpacer(sheet);

    this.addSection(sheet, 'MOLIYA');
    this.addKV(sheet, "Jami sotuv (qog'oz)", report.totalSalesAmount, NUM_FMT);
    this.addKV(sheet, 'Nasiya sotuvlar', report.debtSalesAmount, NUM_FMT);
    this.addKV(sheet, 'Zalog puli', report.prepaymentPaid, NUM_FMT);
    this.addKV(sheet, 'Pul kirimlari', report.moneyIncomes, NUM_FMT);
    this.addKV(sheet, 'Naqd tushum', report.cashReceived, NUM_FMT);
    this.addKV(sheet, 'Xarajatlar', report.totalExpenses, NUM_FMT);
    this.addKV(sheet, 'Ishchi puli (hisoblangan)', report.workerAccrued, NUM_FMT);
    this.addKV(sheet, "Ishchi puli (to'langan)", report.workerPaid, NUM_FMT);
    this.addKV(sheet, 'Sof foyda', report.netProfit, NUM_FMT);
    this.addKV(sheet, 'Kun oxiriga qolgan pul', report.endOfDayBalance, NUM_FMT, true);
    this.addSpacer(sheet);

    this.addDebtorsSection(sheet, debts.unpaidDebtors);
    this.addSpacer(sheet);

    this.addSection(sheet, "OYLAR BO'YICHA");
    this.addTableHeader(sheet, ['Oy', 'Sotuv', 'Xarajat', 'Ishchi puli', 'Kun oxiriga qolgan pul']);
    for (const [monthKey, m] of Object.entries(report.groupedByMonth) as [string, any][]) {
      const row = sheet.addRow([monthKey, m.salesAmount, m.expenses, m.workerAccrued, m.endOfDayBalance]);
      row.getCell(2).numFmt = NUM_FMT;
      row.getCell(3).numFmt = NUM_FMT;
      row.getCell(4).numFmt = NUM_FMT;
      row.getCell(5).numFmt = NUM_FMT;
    }

    return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }
}
