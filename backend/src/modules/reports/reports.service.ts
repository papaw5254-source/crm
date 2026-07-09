import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BrickType } from '../../common/enums/brick-type.enum';
import { PaymentType } from '../../common/enums/payment-type.enum';
import { ReserveMovementType } from '../../common/enums/reserve-movement-type.enum';
import { DebtPayment } from '../debtors/entities/debt-payment.entity';
import { Debtor } from '../debtors/entities/debtor.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { InventoryIncome } from '../inventory/entities/inventory-income.entity';
import { KilnOperation } from '../kiln/entities/kiln-operation.entity';
import { MoneyIncome } from '../money-incomes/entities/money-income.entity';
import { PrepaymentDelivery } from '../prepayments/entities/prepayment-delivery.entity';
import { Prepayment } from '../prepayments/entities/prepayment.entity';
import { ReserveMovement } from '../reserve/entities/reserve-movement.entity';
import { Sale } from '../sales/entities/sale.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { Stock } from '../stock/entities/stock.entity';
import { WorkerPayment } from '../worker-payments/entities/worker-payment.entity';
import { DateRangeDto, DailyReportDto, MonthlyReportDto, YearlyReportDto } from './dto/report-filter.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Sale) private readonly saleRepo: Repository<Sale>,
    @InjectRepository(Expense) private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(InventoryIncome) private readonly inventoryRepo: Repository<InventoryIncome>,
    @InjectRepository(Debtor) private readonly debtorRepo: Repository<Debtor>,
    @InjectRepository(DebtPayment) private readonly debtPaymentRepo: Repository<DebtPayment>,
    @InjectRepository(Stock) private readonly stockRepo: Repository<Stock>,
    @InjectRepository(StockMovement) private readonly stockMovementRepo: Repository<StockMovement>,
    @InjectRepository(KilnOperation) private readonly kilnRepo: Repository<KilnOperation>,
    @InjectRepository(ReserveMovement) private readonly reserveRepo: Repository<ReserveMovement>,
    @InjectRepository(Prepayment) private readonly prepaymentRepo: Repository<Prepayment>,
    @InjectRepository(PrepaymentDelivery) private readonly deliveryRepo: Repository<PrepaymentDelivery>,
    @InjectRepository(MoneyIncome) private readonly moneyIncomeRepo: Repository<MoneyIncome>,
    @InjectRepository(WorkerPayment) private readonly workerPaymentRepo: Repository<WorkerPayment>,
  ) {}

  private async getStockBalance(brickType: BrickType): Promise<number> {
    const s = await this.stockRepo.findOne({ where: { brickType } });
    return s ? s.quantity : 0;
  }

  private async getReserveBalance(brickType: BrickType): Promise<number> {
    const latest = await this.reserveRepo.findOne({ where: { brickType }, order: { createdAt: 'DESC' } });
    return latest ? latest.newQuantity : 0;
  }

  private cashSaleAmount(sales: Sale[]): number {
    return sales
      .filter((x) => [PaymentType.CASH, PaymentType.CARD, PaymentType.BANK_TRANSFER].includes(x.paymentType))
      .reduce((s, x) => s + Number(x.totalAmount), 0);
  }

  private moneyIncomeAmount(incomes: MoneyIncome[]): number {
    return incomes.reduce((s, x) => s + Number(x.amount), 0);
  }

  async getDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';
    const yearStart = today.substring(0, 4) + '-01-01';
    const yearEnd = today.substring(0, 4) + '-12-31';

    const [bakedStock, rawStock, reserveRaw, reserveBaked] = await Promise.all([
      this.getStockBalance(BrickType.BAKED_BRICK),
      this.getStockBalance(BrickType.RAW_BRICK),
      this.getReserveBalance(BrickType.RAW_BRICK),
      this.getReserveBalance(BrickType.BAKED_BRICK),
    ]);

    const todaySales = await this.saleRepo.createQueryBuilder('s').where('s.date = :today', { today }).getMany();
    const todayDebtPayments = await this.debtPaymentRepo.createQueryBuilder('dp').where('dp.date = :today', { today }).getMany();
    const todayExpenses = await this.expenseRepo.createQueryBuilder('e').where('e.date = :today', { today }).getMany();
    const todayMoneyIncomes = await this.moneyIncomeRepo.createQueryBuilder('mi').where('mi.date = :today', { today }).getMany();
    const todayWorkerPayments = await this.workerPaymentRepo.createQueryBuilder('wp').where('wp.date = :today', { today }).getMany();
    const todayPrepayments = await this.prepaymentRepo.createQueryBuilder('p').where('p.date = :today', { today }).getMany();

    const todaySalesAmount = todaySales.reduce((s, x) => s + Number(x.totalAmount), 0);
    const todayCashSales = todaySales.filter(x => x.paymentType === PaymentType.CASH).reduce((s, x) => s + Number(x.totalAmount), 0);
    const todayCardSales = todaySales.filter(x => x.paymentType === PaymentType.CARD).reduce((s, x) => s + Number(x.totalAmount), 0);
    const todayBankTransferSales = todaySales.filter(x => x.paymentType === PaymentType.BANK_TRANSFER).reduce((s, x) => s + Number(x.totalAmount), 0);
    const todayDebtSales = todaySales.filter(x => x.paymentType === PaymentType.DEBT).reduce((s, x) => s + Number(x.totalAmount), 0);
    const todayDebtPaymentsTotal = todayDebtPayments.reduce((s, x) => s + Number(x.amount), 0);
    const todayExpensesTotal = todayExpenses.reduce((s, x) => s + Number(x.amount), 0);
    const todayMoneyIncomesTotal = todayMoneyIncomes.reduce((s, x) => s + Number(x.amount), 0);
    const todayPrepaymentPaid = todayPrepayments.reduce((s, x) => s + Number(x.paidAmount), 0);
    const todayWorkerAccrued = todayWorkerPayments.reduce((s, x) => s + Number(x.amount), 0);

    const receivedCash = todayCashSales + todayCardSales + todayBankTransferSales + todayDebtPaymentsTotal + todayPrepaymentPaid + todayMoneyIncomesTotal;
    const todayProfit = receivedCash - todayExpensesTotal - todayWorkerAccrued;

    // Monthly
    const [monthlySales, monthlyDebtPay, monthlyExpenses, monthlyMoneyIn, monthlyWorkerPay, monthlyPrepayments] = await Promise.all([
      this.saleRepo.createQueryBuilder('s').where('s.date >= :ms AND s.date <= :today', { ms: monthStart, today }).getMany(),
      this.debtPaymentRepo.createQueryBuilder('dp').where('dp.date >= :ms AND dp.date <= :today', { ms: monthStart, today }).getMany(),
      this.expenseRepo.createQueryBuilder('e').where('e.date >= :ms AND e.date <= :today', { ms: monthStart, today }).getMany(),
      this.moneyIncomeRepo.createQueryBuilder('mi').where('mi.date >= :ms AND mi.date <= :today', { ms: monthStart, today }).getMany(),
      this.workerPaymentRepo.createQueryBuilder('wp').where('wp.date >= :ms AND wp.date <= :today', { ms: monthStart, today }).getMany(),
      this.prepaymentRepo.createQueryBuilder('p').where('p.date >= :ms AND p.date <= :today', { ms: monthStart, today }).getMany(),
    ]);

    const mCash = this.cashSaleAmount(monthlySales);
    const mDebtPay = monthlyDebtPay.reduce((s, x) => s + Number(x.amount), 0);
    const mExp = monthlyExpenses.reduce((s, x) => s + Number(x.amount), 0);
    const mMoneyIn = this.moneyIncomeAmount(monthlyMoneyIn);
    const mWorkerAccrued = monthlyWorkerPay.reduce((s, x) => s + Number(x.amount), 0);
    const mPrepaymentPaid = monthlyPrepayments.reduce((s, x) => s + Number(x.paidAmount), 0);
    const monthlyProfit = mCash + mDebtPay + mPrepaymentPaid + mMoneyIn - mExp - mWorkerAccrued;

    const [yearlySales, yearlyDebtPay, yearlyExpenses, yearlyMoneyIn, yearlyWorkerPay, yearlyPrepayments] = await Promise.all([
      this.saleRepo.createQueryBuilder('s').where('s.date >= :ys AND s.date <= :ye', { ys: yearStart, ye: yearEnd }).getMany(),
      this.debtPaymentRepo.createQueryBuilder('dp').where('dp.date >= :ys AND dp.date <= :ye', { ys: yearStart, ye: yearEnd }).getMany(),
      this.expenseRepo.createQueryBuilder('e').where('e.date >= :ys AND e.date <= :ye', { ys: yearStart, ye: yearEnd }).getMany(),
      this.moneyIncomeRepo.createQueryBuilder('mi').where('mi.date >= :ys AND mi.date <= :ye', { ys: yearStart, ye: yearEnd }).getMany(),
      this.workerPaymentRepo.createQueryBuilder('wp').where('wp.date >= :ys AND wp.date <= :ye', { ys: yearStart, ye: yearEnd }).getMany(),
      this.prepaymentRepo.createQueryBuilder('p').where('p.date >= :ys AND p.date <= :ye', { ys: yearStart, ye: yearEnd }).getMany(),
    ]);

    const yCash = this.cashSaleAmount(yearlySales);
    const yDebtPay = yearlyDebtPay.reduce((s, x) => s + Number(x.amount), 0);
    const yExp = yearlyExpenses.reduce((s, x) => s + Number(x.amount), 0);
    const yMoneyIn = this.moneyIncomeAmount(yearlyMoneyIn);
    const yWorkerAccrued = yearlyWorkerPay.reduce((s, x) => s + Number(x.amount), 0);
    const yPrepaymentPaid = yearlyPrepayments.reduce((s, x) => s + Number(x.paidAmount), 0);
    const yearlyProfit = yCash + yDebtPay + yPrepaymentPaid + yMoneyIn - yExp - yWorkerAccrued;

    const totalDebts = await this.debtorRepo.createQueryBuilder('d').select('SUM(d.remainingDebt)', 'v').getRawOne();
    const workerDebts = await this.workerPaymentRepo.createQueryBuilder('wp').select('SUM(wp.remainingDebt)', 'v').getRawOne();

    const recentSales = await this.saleRepo.find({ order: { createdAt: 'DESC' }, take: 5, relations: ['createdBy'] });
    const recentExpenses = await this.expenseRepo.find({ order: { createdAt: 'DESC' }, take: 5, relations: ['createdBy'] });
    const recentStockMovements = await this.stockMovementRepo.find({ order: { createdAt: 'DESC' }, take: 5, relations: ['createdBy'] });

    return {
      bakedBrickStock: bakedStock,
      rawBrickStock: rawStock,
      reserveRawBrick: reserveRaw,
      reserveBakedBrick: reserveBaked,
      currentStock: bakedStock,
      todaySalesAmount,
      todayIncome: receivedCash,
      todayCashReceived: receivedCash,
      todayDebtAmount: todayDebtSales,
      todayExpense: todayExpensesTotal,
      todayExpenses: todayExpensesTotal,
      todayProfit,
      monthlyProfit,
      yearlyProfit,
      totalDebts: parseFloat(totalDebts?.v) || 0,
      totalWorkerDebts: parseFloat(workerDebts?.v) || 0,
      recentSales,
      recentExpenses,
      recentStockMovements,
    };
  }

  async getDailyReport(query: DailyReportDto) {
    const date = query.date || new Date().toISOString().split('T')[0];

    const [sales, incomes, expenses, debtPayments, kilnOps, reserveMovements, moneyIncomes, workerPayments, prepayments] = await Promise.all([
      this.saleRepo.createQueryBuilder('s').where('s.date = :date', { date }).getMany(),
      this.inventoryRepo.createQueryBuilder('i').where('i.date = :date', { date }).getMany(),
      this.expenseRepo.createQueryBuilder('e').where('e.date = :date', { date }).getMany(),
      this.debtPaymentRepo.createQueryBuilder('dp').where('dp.date = :date', { date }).getMany(),
      this.kilnRepo.createQueryBuilder('k').where('k.date = :date', { date }).getMany(),
      this.reserveRepo.createQueryBuilder('r').where('r.date = :date', { date }).getMany(),
      this.moneyIncomeRepo.createQueryBuilder('mi').where('mi.date = :date', { date }).getMany(),
      this.workerPaymentRepo.createQueryBuilder('wp').where('wp.date = :date', { date }).getMany(),
      this.prepaymentRepo.createQueryBuilder('p').where('p.date = :date', { date }).getMany(),
    ]);

    const rawSales = sales.filter(s => s.brickType === BrickType.RAW_BRICK);
    const bakedSales = sales.filter(s => s.brickType === BrickType.BAKED_BRICK);
    const rawIncomes = incomes.filter(i => i.brickType === BrickType.RAW_BRICK);
    const bakedIncomes = incomes.filter(i => i.brickType === BrickType.BAKED_BRICK);
    const rawReserveMoves = reserveMovements.filter(r => r.brickType === BrickType.RAW_BRICK);
    const bakedReserveMoves = reserveMovements.filter(r => r.brickType === BrickType.BAKED_BRICK);
    const reserveSales = sales.filter(s => s.isReserveSale);
    const rawReserveSales = reserveSales.filter(s => s.brickType === BrickType.RAW_BRICK);
    const bakedReserveSales = reserveSales.filter(s => s.brickType === BrickType.BAKED_BRICK);

    const totalSalesAmount = sales.reduce((s, x) => s + Number(x.totalAmount), 0);
    const cashSales = sales.filter(x => x.paymentType === PaymentType.CASH).reduce((s, x) => s + Number(x.totalAmount), 0);
    const cardSales = sales.filter(x => x.paymentType === PaymentType.CARD).reduce((s, x) => s + Number(x.totalAmount), 0);
    const bankTransferSales = sales.filter(x => x.paymentType === PaymentType.BANK_TRANSFER).reduce((s, x) => s + Number(x.totalAmount), 0);
    const debtSalesAmount = sales.filter(x => x.paymentType === PaymentType.DEBT).reduce((s, x) => s + Number(x.totalAmount), 0);
    const prepaymentSales = sales.filter(x => x.paymentType === PaymentType.PREPAYMENT).reduce((s, x) => s + Number(x.totalAmount), 0);
    const debtPaymentsTotal = debtPayments.reduce((s, x) => s + Number(x.amount), 0);
    const prepaymentPaid = prepayments.reduce((s, x) => s + Number(x.paidAmount), 0);
    const moneyIncomesTotal = this.moneyIncomeAmount(moneyIncomes);
    const totalExpenses = expenses.reduce((s, x) => s + Number(x.amount), 0);
    const workerAccrued = workerPayments.reduce((s, x) => s + Number(x.amount), 0);
    const workerPaid = workerPayments.reduce((s, x) => s + Number(x.paidAmount), 0);

    const workerByCategory: Record<string, { accrued: number; paid: number }> = {};
    workerPayments.forEach((wp) => {
      if (!workerByCategory[wp.category]) workerByCategory[wp.category] = { accrued: 0, paid: 0 };
      workerByCategory[wp.category].accrued += Number(wp.amount);
      workerByCategory[wp.category].paid += Number(wp.paidAmount);
    });

    const expensesByCategory: Record<string, number> = {};
    expenses.forEach((e) => {
      expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + Number(e.amount);
    });

    const receivedCash = cashSales + cardSales + bankTransferSales + debtPaymentsTotal + prepaymentPaid + moneyIncomesTotal;
    const netProfit = receivedCash - totalExpenses - workerAccrued;
    const paperProfit = totalSalesAmount - totalExpenses - workerAccrued;

    const [bakedStock, rawStock, reserveRaw, reserveBaked] = await Promise.all([
      this.getStockBalance(BrickType.BAKED_BRICK),
      this.getStockBalance(BrickType.RAW_BRICK),
      this.getReserveBalance(BrickType.RAW_BRICK),
      this.getReserveBalance(BrickType.BAKED_BRICK),
    ]);

    return {
      date,
      rawBrickProduced: rawIncomes.reduce((s, x) => s + x.quantity, 0),
      bakedBrickProduced: kilnOps.reduce((s, x) => s + x.bakedBricksOutput, 0),
      rawBrickToKiln: kilnOps.reduce((s, x) => s + x.rawBricksEntered, 0),
      rawBrickToKilnFromReserve: kilnOps.filter(x => x.rawBrickSource === 'RESERVE').reduce((s, x) => s + x.rawBricksEntered, 0),
      rawBrickToKilnFromField: kilnOps.filter(x => x.rawBrickSource === 'FIELD').reduce((s, x) => s + x.rawBricksEntered, 0),
      rawBrickSold: rawSales.reduce((s, x) => s + x.quantity, 0),
      bakedBrickSold: bakedSales.reduce((s, x) => s + x.quantity, 0),
      reserveRawAdded: rawReserveMoves.filter(x => x.movementType === ReserveMovementType.ADD).reduce((s, x) => s + x.quantity, 0),
      reserveBakedAdded: bakedReserveMoves.filter(x => x.movementType === ReserveMovementType.ADD).reduce((s, x) => s + x.quantity, 0),
      reserveRawSold: rawReserveSales.reduce((s, x) => s + x.quantity, 0),
      reserveBakedSold: bakedReserveSales.reduce((s, x) => s + x.quantity, 0),
      reserveRawToKiln: rawReserveMoves.filter(x => x.movementType === ReserveMovementType.TO_KILN).reduce((s, x) => s + x.quantity, 0),
      reserveRawRemoved: rawReserveMoves.filter(x => x.movementType === ReserveMovementType.REMOVE).reduce((s, x) => s + x.quantity, 0),
      reserveBakedRemoved: bakedReserveMoves.filter(x => x.movementType === ReserveMovementType.REMOVE).reduce((s, x) => s + x.quantity, 0),
      totalAddedBricks: incomes.reduce((s, x) => s + x.quantity, 0),
      totalSoldBricks: sales.reduce((s, x) => s + x.quantity, 0),
      reserveSoldBricks: reserveSales.reduce((s, x) => s + x.quantity, 0),
      totalSalesAmount,
      cashSales,
      cardSales,
      bankTransferSales,
      debtSalesAmount,
      prepaymentSales,
      debtPayments: debtPaymentsTotal,
      prepaymentPaid,
      moneyIncomes: moneyIncomesTotal,
      totalExpenses,
      expensesByCategory,
      workerAccrued,
      workerPayments: workerPaid,
      workerByCategory,
      receivedCash,
      netProfit,
      paperProfit,
      bakedBrickStock: bakedStock,
      rawBrickStock: rawStock,
      reserveRawBrick: reserveRaw,
      reserveBakedBrick: reserveBaked,
      stockAtEndOfDay: bakedStock,
    };
  }

  async getMonthlyReport(query: MonthlyReportDto) {
    const now = new Date();
    const year = query.year || now.getFullYear();
    const month = query.month || now.getMonth() + 1;
    const monthStr = String(month).padStart(2, '0');
    const dateFrom = `${year}-${monthStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const dateTo = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    const [sales, expenses, debtPayments, incomes, moneyIncomes, workerPayments, prepayments] = await Promise.all([
      this.saleRepo.createQueryBuilder('s').where('s.date >= :df AND s.date <= :dt', { df: dateFrom, dt: dateTo }).getMany(),
      this.expenseRepo.createQueryBuilder('e').where('e.date >= :df AND e.date <= :dt', { df: dateFrom, dt: dateTo }).getMany(),
      this.debtPaymentRepo.createQueryBuilder('dp').where('dp.date >= :df AND dp.date <= :dt', { df: dateFrom, dt: dateTo }).getMany(),
      this.inventoryRepo.createQueryBuilder('i').where('i.date >= :df AND i.date <= :dt', { df: dateFrom, dt: dateTo }).getMany(),
      this.moneyIncomeRepo.createQueryBuilder('mi').where('mi.date >= :df AND mi.date <= :dt', { df: dateFrom, dt: dateTo }).getMany(),
      this.workerPaymentRepo.createQueryBuilder('wp').where('wp.date >= :df AND wp.date <= :dt', { df: dateFrom, dt: dateTo }).getMany(),
      this.prepaymentRepo.createQueryBuilder('p').where('p.date >= :df AND p.date <= :dt', { df: dateFrom, dt: dateTo }).getMany(),
    ]);

    const totalSalesAmount = sales.reduce((s, x) => s + Number(x.totalAmount), 0);
    const cashReceived = this.cashSaleAmount(sales)
      + debtPayments.reduce((s, x) => s + Number(x.amount), 0)
      + prepayments.reduce((s, x) => s + Number(x.paidAmount), 0)
      + this.moneyIncomeAmount(moneyIncomes);
    const debtSalesAmount = sales.filter(x => x.paymentType === PaymentType.DEBT).reduce((s, x) => s + Number(x.totalAmount), 0);
    const totalExpenses = expenses.reduce((s, x) => s + Number(x.amount), 0);
    const workerAccrued = workerPayments.reduce((s, x) => s + Number(x.amount), 0);
    const workerPaid = workerPayments.reduce((s, x) => s + Number(x.paidAmount), 0);
    const netProfit = cashReceived - totalExpenses - workerAccrued;
    const paperProfit = totalSalesAmount - totalExpenses - workerAccrued;

    const dailyData: Record<string, any> = {};
    for (let d = 1; d <= lastDay; d++) {
      const dayStr = `${year}-${monthStr}-${String(d).padStart(2, '0')}`;
      const dSales = sales.filter(x => x.date === dayStr);
      const dExp = expenses.filter(x => x.date === dayStr);
      const dInc = incomes.filter(x => x.date === dayStr);
      const dDebtPayments = debtPayments.filter(x => x.date === dayStr);
      const dMoneyIncomes = moneyIncomes.filter(x => x.date === dayStr);
      const dWorkerPayments = workerPayments.filter(x => x.date === dayStr);
      const dPrepayments = prepayments.filter(x => x.date === dayStr);
      const dCashReceived = this.cashSaleAmount(dSales)
        + dDebtPayments.reduce((s, x) => s + Number(x.amount), 0)
        + dPrepayments.reduce((s, x) => s + Number(x.paidAmount), 0)
        + this.moneyIncomeAmount(dMoneyIncomes);
      const dExpenses = dExp.reduce((s, x) => s + Number(x.amount), 0);
      const dWorkerAccrued = dWorkerPayments.reduce((s, x) => s + Number(x.amount), 0);
      dailyData[dayStr] = {
        salesAmount: dSales.reduce((s, x) => s + Number(x.totalAmount), 0),
        soldBricks: dSales.reduce((s, x) => s + x.quantity, 0),
        addedBricks: dInc.reduce((s, x) => s + x.quantity, 0),
        expenses: dExpenses,
        workerAccrued: dWorkerAccrued,
        cashReceived: dCashReceived,
        profit: dCashReceived - dExpenses - dWorkerAccrued,
      };
    }

    const expenseByCategory: Record<string, number> = {};
    expenses.forEach(e => { expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + Number(e.amount); });

    return {
      year, month, dateFrom, dateTo,
      totalAddedBricks: incomes.reduce((s, x) => s + x.quantity, 0),
      totalSoldBricks: sales.reduce((s, x) => s + x.quantity, 0),
      totalSalesAmount, cashReceived, debtSalesAmount, totalExpenses, workerAccrued, workerPaid, netProfit, paperProfit,
      groupedByDay: dailyData,
      expenseByCategory,
      bestSalesDay: Object.entries(dailyData).sort((a, b) => b[1].salesAmount - a[1].salesAmount)[0]
        ? { date: Object.entries(dailyData).sort((a, b) => b[1].salesAmount - a[1].salesAmount)[0][0], ...Object.entries(dailyData).sort((a, b) => b[1].salesAmount - a[1].salesAmount)[0][1] }
        : null,
    };
  }

  async getYearlyReport(query: YearlyReportDto) {
    const year = query.year || new Date().getFullYear();
    const dateFrom = `${year}-01-01`;
    const dateTo = `${year}-12-31`;

    const [sales, expenses, debtPayments, incomes, moneyIncomes, workerPayments, prepayments] = await Promise.all([
      this.saleRepo.createQueryBuilder('s').where('s.date >= :df AND s.date <= :dt', { df: dateFrom, dt: dateTo }).getMany(),
      this.expenseRepo.createQueryBuilder('e').where('e.date >= :df AND e.date <= :dt', { df: dateFrom, dt: dateTo }).getMany(),
      this.debtPaymentRepo.createQueryBuilder('dp').where('dp.date >= :df AND dp.date <= :dt', { df: dateFrom, dt: dateTo }).getMany(),
      this.inventoryRepo.createQueryBuilder('i').where('i.date >= :df AND i.date <= :dt', { df: dateFrom, dt: dateTo }).getMany(),
      this.moneyIncomeRepo.createQueryBuilder('mi').where('mi.date >= :df AND mi.date <= :dt', { df: dateFrom, dt: dateTo }).getMany(),
      this.workerPaymentRepo.createQueryBuilder('wp').where('wp.date >= :df AND wp.date <= :dt', { df: dateFrom, dt: dateTo }).getMany(),
      this.prepaymentRepo.createQueryBuilder('p').where('p.date >= :df AND p.date <= :dt', { df: dateFrom, dt: dateTo }).getMany(),
    ]);

    const totalSalesAmount = sales.reduce((s, x) => s + Number(x.totalAmount), 0);
    const cashReceived = this.cashSaleAmount(sales)
      + debtPayments.reduce((s, x) => s + Number(x.amount), 0)
      + prepayments.reduce((s, x) => s + Number(x.paidAmount), 0)
      + this.moneyIncomeAmount(moneyIncomes);
    const totalExpenses = expenses.reduce((s, x) => s + Number(x.amount), 0);
    const workerAccrued = workerPayments.reduce((s, x) => s + Number(x.amount), 0);
    const workerPaid = workerPayments.reduce((s, x) => s + Number(x.paidAmount), 0);
    const netProfit = cashReceived - totalExpenses - workerAccrued;
    const paperProfit = totalSalesAmount - totalExpenses - workerAccrued;

    const monthlyData: Record<string, any> = {};
    for (let m = 1; m <= 12; m++) {
      const ms = String(m).padStart(2, '0');
      const prefix = `${year}-${ms}`;
      const mSales = sales.filter(x => x.date.startsWith(prefix));
      const mExp = expenses.filter(x => x.date.startsWith(prefix));
      const mInc = incomes.filter(x => x.date.startsWith(prefix));
      const mDebtPayments = debtPayments.filter(x => x.date.startsWith(prefix));
      const mMoneyIncomes = moneyIncomes.filter(x => x.date.startsWith(prefix));
      const mWorkerPayments = workerPayments.filter(x => x.date.startsWith(prefix));
      const mPrepayments = prepayments.filter(x => x.date.startsWith(prefix));
      const mCashReceived = this.cashSaleAmount(mSales)
        + mDebtPayments.reduce((s, x) => s + Number(x.amount), 0)
        + mPrepayments.reduce((s, x) => s + Number(x.paidAmount), 0)
        + this.moneyIncomeAmount(mMoneyIncomes);
      const mExpenses = mExp.reduce((s, x) => s + Number(x.amount), 0);
      const mWorkerAccrued = mWorkerPayments.reduce((s, x) => s + Number(x.amount), 0);
      monthlyData[prefix] = {
        salesAmount: mSales.reduce((s, x) => s + Number(x.totalAmount), 0),
        soldBricks: mSales.reduce((s, x) => s + x.quantity, 0),
        addedBricks: mInc.reduce((s, x) => s + x.quantity, 0),
        expenses: mExpenses,
        workerAccrued: mWorkerAccrued,
        cashReceived: mCashReceived,
        profit: mCashReceived - mExpenses - mWorkerAccrued,
      };
    }

    const expenseByCategory: Record<string, number> = {};
    expenses.forEach(e => { expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + Number(e.amount); });

    return {
      year, totalAddedBricks: incomes.reduce((s, x) => s + x.quantity, 0),
      totalSoldBricks: sales.reduce((s, x) => s + x.quantity, 0),
      totalSalesAmount, cashReceived,
      debtSalesAmount: sales.filter(x => x.paymentType === PaymentType.DEBT).reduce((s, x) => s + Number(x.totalAmount), 0),
      totalExpenses, workerAccrued, workerPaid, netProfit, paperProfit,
      groupedByMonth: monthlyData, expenseByCategory,
    };
  }

  async getInventoryReport(query: DateRangeDto) {
    const dateFrom = query.dateFrom || '2000-01-01';
    const dateTo = query.dateTo || new Date().toISOString().split('T')[0];

    const [bakedIncome, rawIncome, bakedSold, rawSold, bakedStock, rawStock] = await Promise.all([
      this.inventoryRepo.createQueryBuilder('i').select('SUM(i.quantity)', 'total').where('i.brickType = :bt AND i.date >= :df AND i.date <= :dt', { bt: BrickType.BAKED_BRICK, df: dateFrom, dt: dateTo }).getRawOne(),
      this.inventoryRepo.createQueryBuilder('i').select('SUM(i.quantity)', 'total').where('i.brickType = :bt AND i.date >= :df AND i.date <= :dt', { bt: BrickType.RAW_BRICK, df: dateFrom, dt: dateTo }).getRawOne(),
      this.saleRepo.createQueryBuilder('s').select('SUM(s.quantity)', 'total').where('s.brickType = :bt AND s.date >= :df AND s.date <= :dt', { bt: BrickType.BAKED_BRICK, df: dateFrom, dt: dateTo }).getRawOne(),
      this.saleRepo.createQueryBuilder('s').select('SUM(s.quantity)', 'total').where('s.brickType = :bt AND s.date >= :df AND s.date <= :dt', { bt: BrickType.RAW_BRICK, df: dateFrom, dt: dateTo }).getRawOne(),
      this.getStockBalance(BrickType.BAKED_BRICK),
      this.getStockBalance(BrickType.RAW_BRICK),
    ]);

    return {
      dateFrom, dateTo,
      bakedBrick: { income: parseInt(bakedIncome?.total) || 0, sold: parseInt(bakedSold?.total) || 0, currentStock: bakedStock },
      rawBrick: { income: parseInt(rawIncome?.total) || 0, sold: parseInt(rawSold?.total) || 0, currentStock: rawStock },
      totalIncome: (parseInt(bakedIncome?.total) || 0) + (parseInt(rawIncome?.total) || 0),
      totalSales: (parseInt(bakedSold?.total) || 0) + (parseInt(rawSold?.total) || 0),
      currentStock: bakedStock,
    };
  }

  async getDebtReport() {
    const [customerStats, workerStats, unpaidDebtors, workerDebts] = await Promise.all([
      this.debtorRepo.createQueryBuilder('d').select('COUNT(*)', 'total').addSelect('SUM(d.totalDebt)', 'debt').addSelect('SUM(d.paidAmount)', 'paid').addSelect('SUM(d.remainingDebt)', 'remaining').getRawOne(),
      this.workerPaymentRepo.createQueryBuilder('wp').select('SUM(wp.remainingDebt)', 'remaining').getRawOne(),
      this.debtorRepo.find({ where: { isPaid: false }, order: { remainingDebt: 'DESC' } }),
      this.workerPaymentRepo.createQueryBuilder('wp').where('wp.remainingDebt > 0').orderBy('wp.remainingDebt', 'DESC').getMany(),
    ]);

    return {
      totalDebtors: parseInt(customerStats?.total) || 0,
      totalDebt: parseFloat(customerStats?.debt) || 0,
      totalPaid: parseFloat(customerStats?.paid) || 0,
      totalCustomerRemainingDebt: parseFloat(customerStats?.remaining) || 0,
      unpaidDebtors,
      customerDebts: {
        totalDebtors: parseInt(customerStats?.total) || 0,
        totalDebt: parseFloat(customerStats?.debt) || 0,
        totalPaid: parseFloat(customerStats?.paid) || 0,
        totalRemainingDebt: parseFloat(customerStats?.remaining) || 0,
        unpaidDebtors,
      },
      workerDebts: {
        totalWorkers: workerDebts.length,
        totalDebt: parseFloat(workerStats?.remaining) || 0,
        totalRemainingDebt: parseFloat(workerStats?.remaining) || 0,
        debtors: workerDebts,
      },
      totalRemainingDebt: (parseFloat(customerStats?.remaining) || 0) + (parseFloat(workerStats?.remaining) || 0),
    };
  }

  async getExpenseReport(query: DateRangeDto) {
    const dateFrom = query.dateFrom || new Date().toISOString().split('T')[0].substring(0, 7) + '-01';
    const dateTo = query.dateTo || new Date().toISOString().split('T')[0];

    const expenses = await this.expenseRepo.createQueryBuilder('e').where('e.date >= :df AND e.date <= :dt', { df: dateFrom, dt: dateTo }).orderBy('e.date', 'DESC').getMany();
    const totalExpenses = expenses.reduce((s, x) => s + Number(x.amount), 0);

    const expensesByCategory: Record<string, number> = {};
    const expensesByDate: Record<string, number> = {};
    expenses.forEach(e => {
      expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + Number(e.amount);
      expensesByDate[e.date] = (expensesByDate[e.date] || 0) + Number(e.amount);
    });

    return { dateFrom, dateTo, totalExpenses, expensesByCategory, expensesByDate, expenses };
  }

  async getSalesReport(query: DateRangeDto) {
    const dateFrom = query.dateFrom || new Date().toISOString().split('T')[0].substring(0, 7) + '-01';
    const dateTo = query.dateTo || new Date().toISOString().split('T')[0];

    const sales = await this.saleRepo.createQueryBuilder('s').where('s.date >= :df AND s.date <= :dt', { df: dateFrom, dt: dateTo }).orderBy('s.date', 'DESC').getMany();
    const totalSalesAmount = sales.reduce((s, x) => s + Number(x.totalAmount), 0);
    const totalSoldBricks = sales.reduce((s, x) => s + x.quantity, 0);

    const salesByPaymentType: Record<string, { count: number; amount: number }> = {};
    const salesByBrickType: Record<string, { count: number; amount: number; quantity: number }> = {};
    const salesByDate: Record<string, number> = {};
    sales.forEach(s => {
      if (!salesByPaymentType[s.paymentType]) salesByPaymentType[s.paymentType] = { count: 0, amount: 0 };
      salesByPaymentType[s.paymentType].count++;
      salesByPaymentType[s.paymentType].amount += Number(s.totalAmount);
      if (!salesByBrickType[s.brickType]) salesByBrickType[s.brickType] = { count: 0, amount: 0, quantity: 0 };
      salesByBrickType[s.brickType].count++;
      salesByBrickType[s.brickType].amount += Number(s.totalAmount);
      salesByBrickType[s.brickType].quantity += s.quantity;
      salesByDate[s.date] = (salesByDate[s.date] || 0) + Number(s.totalAmount);
    });

    return { dateFrom, dateTo, totalSales: sales.length, totalSoldBricks, totalSalesAmount, salesByPaymentType, salesByBrickType, salesByDate, sales };
  }

  async getCashflowReport(query: DateRangeDto) {
    const dateFrom = query.dateFrom || new Date().toISOString().split('T')[0].substring(0, 7) + '-01';
    const dateTo = query.dateTo || new Date().toISOString().split('T')[0];

    const [sales, debtPayments, prepayments, moneyIncomes, expenses, workerPayments] = await Promise.all([
      this.saleRepo.createQueryBuilder('s').where('s.date >= :df AND s.date <= :dt', { df: dateFrom, dt: dateTo }).getMany(),
      this.debtPaymentRepo.createQueryBuilder('dp').where('dp.date >= :df AND dp.date <= :dt', { df: dateFrom, dt: dateTo }).getMany(),
      this.prepaymentRepo.createQueryBuilder('p').where('p.date >= :df AND p.date <= :dt', { df: dateFrom, dt: dateTo }).getMany(),
      this.moneyIncomeRepo.createQueryBuilder('mi').where('mi.date >= :df AND mi.date <= :dt', { df: dateFrom, dt: dateTo }).getMany(),
      this.expenseRepo.createQueryBuilder('e').where('e.date >= :df AND e.date <= :dt', { df: dateFrom, dt: dateTo }).getMany(),
      this.workerPaymentRepo.createQueryBuilder('wp').where('wp.date >= :df AND wp.date <= :dt', { df: dateFrom, dt: dateTo }).getMany(),
    ]);

    const cashSales = sales.filter(x => x.paymentType === PaymentType.CASH).reduce((s, x) => s + Number(x.totalAmount), 0);
    const cardSales = sales.filter(x => x.paymentType === PaymentType.CARD).reduce((s, x) => s + Number(x.totalAmount), 0);
    const bankTransferSales = sales.filter(x => x.paymentType === PaymentType.BANK_TRANSFER).reduce((s, x) => s + Number(x.totalAmount), 0);
    const debtSales = sales.filter(x => x.paymentType === PaymentType.DEBT).reduce((s, x) => s + Number(x.totalAmount), 0);
    const debtPaymentsTotal = debtPayments.reduce((s, x) => s + Number(x.amount), 0);
    const prepaymentPaid = prepayments.reduce((s, x) => s + Number(x.paidAmount), 0);
    const founderIncome = moneyIncomes.filter(x => x.source === 'FOUNDER').reduce((s, x) => s + Number(x.amount), 0);
    const bankIncome = moneyIncomes.filter(x => x.source === 'BANK').reduce((s, x) => s + Number(x.amount), 0);
    const otherIncome = moneyIncomes.filter(x => x.source !== 'FOUNDER' && x.source !== 'BANK').reduce((s, x) => s + Number(x.amount), 0);
    const totalExpenses = expenses.reduce((s, x) => s + Number(x.amount), 0);
    const workerPaid = workerPayments.reduce((s, x) => s + Number(x.paidAmount), 0);

    const totalInflow = cashSales + cardSales + bankTransferSales + debtPaymentsTotal + prepaymentPaid + founderIncome + bankIncome + otherIncome;
    const totalOutflow = totalExpenses + workerPaid;
    const netCashflow = totalInflow - totalOutflow;

    return {
      dateFrom, dateTo,
      totalInflows: totalInflow,
      totalOutflows: totalOutflow,
      inflows: { cashSales, cardSales, bankTransferSales, debtPayments: debtPaymentsTotal, prepayments: prepaymentPaid, moneyIncomes: founderIncome + bankIncome + otherIncome, founderIncome, bankIncome, otherIncome, total: totalInflow },
      outflows: { expenses: totalExpenses, workerPayments: workerPaid, total: totalOutflow },
      debtSales,
      netCashflow,
      note: 'debtSales are NOT included in inflows — they are paper income only',
    };
  }

  async getExcelStyleReport(query: DailyReportDto) {
    const date = query.date || new Date().toISOString().split('T')[0];
    const daily = await this.getDailyReport(query);

    const [bakedStock, rawStock, reserveRaw, reserveBaked] = await Promise.all([
      this.getStockBalance(BrickType.BAKED_BRICK),
      this.getStockBalance(BrickType.RAW_BRICK),
      this.getReserveBalance(BrickType.RAW_BRICK),
      this.getReserveBalance(BrickType.BAKED_BRICK),
    ]);

    const kilnOps = await this.kilnRepo.createQueryBuilder('k').where('k.date = :date', { date }).leftJoinAndSelect('k.createdBy', 'u').getMany();
    const expenses = await this.expenseRepo.createQueryBuilder('e').where('e.date = :date', { date }).getMany();

    return {
      date,
      production: {
        rawBrickProduced: daily.rawBrickProduced,
        bakedBrickProduced: daily.bakedBrickProduced,
        kilnOperations: kilnOps,
      },
      sales: {
        rawBrickSold: daily.rawBrickSold,
        bakedBrickSold: daily.bakedBrickSold,
        cashSales: daily.cashSales,
        cardSales: daily.cardSales,
        bankTransferSales: daily.bankTransferSales,
        debtSales: daily.debtSalesAmount,
        prepaymentSales: daily.prepaymentSales,
        total: daily.totalSalesAmount,
      },
      cashflow: {
        cashSales: daily.cashSales,
        debtPayments: daily.debtPayments,
        prepayments: daily.prepaymentPaid,
        otherIncomes: daily.moneyIncomes,
        expenses: daily.totalExpenses,
        workerPayments: daily.workerPayments,
        receivedCash: daily.receivedCash,
        netProfit: daily.netProfit,
        paperProfit: daily.paperProfit,
      },
      stock: {
        bakedBrick: bakedStock,
        rawBrick: rawStock,
        reserveRaw: reserveRaw,
        reserveBaked: reserveBaked,
      },
      expenses: expenses.map(e => ({ category: e.category, amount: Number(e.amount), description: e.description })),
    };
  }

  async getStockReport() {
    const [stocks, reserveRaw, reserveBaked] = await Promise.all([
      this.stockRepo.find(),
      this.getReserveBalance(BrickType.RAW_BRICK),
      this.getReserveBalance(BrickType.BAKED_BRICK),
    ]);
    const rawBrickStock = stocks.find((s) => s.brickType === BrickType.RAW_BRICK)?.quantity ?? 0;
    const bakedBrickStock = stocks.find((s) => s.brickType === BrickType.BAKED_BRICK)?.quantity ?? 0;
    return {
      rawBrickStock,
      bakedBrickStock,
      reserveRawBrick: reserveRaw,
      reserveBakedBrick: reserveBaked,
      totalRawBrick: rawBrickStock + reserveRaw,
      totalBakedBrick: bakedBrickStock + reserveBaked,
    };
  }
}
