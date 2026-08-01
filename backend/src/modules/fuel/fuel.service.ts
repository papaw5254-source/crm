import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateFuelExpenseDto } from './dto/create-fuel-expense.dto';
import { CreateFuelIncomeDto } from './dto/create-fuel-income.dto';
import { FuelQueryDto } from './dto/fuel-query.dto';
import { FuelExpense } from './entities/fuel-expense.entity';
import { FuelIncome } from './entities/fuel-income.entity';

@Injectable()
export class FuelService {
  constructor(
    @InjectRepository(FuelIncome)
    private readonly incomeRepository: Repository<FuelIncome>,
    @InjectRepository(FuelExpense)
    private readonly expenseRepository: Repository<FuelExpense>,
  ) {}

  async createIncome(dto: CreateFuelIncomeDto, userId: string): Promise<FuelIncome> {
    const totalAmount = Number((dto.liters * dto.pricePerLiter).toFixed(2));
    const income = this.incomeRepository.create({
      ...dto,
      totalAmount,
      createdById: userId,
    });
    return this.incomeRepository.save(income);
  }

  async findAllIncomes(query: FuelQueryDto): Promise<FuelIncome[]> {
    const qb = this.incomeRepository.createQueryBuilder('i').orderBy('i.date', 'DESC').addOrderBy('i.createdAt', 'DESC');
    if (query.date) qb.andWhere('i.date = :date', { date: query.date });
    if (query.dateFrom) qb.andWhere('i.date >= :dateFrom', { dateFrom: query.dateFrom });
    if (query.dateTo) qb.andWhere('i.date <= :dateTo', { dateTo: query.dateTo });
    return qb.getMany();
  }

  async removeIncome(id: string): Promise<void> {
    const income = await this.incomeRepository.findOne({ where: { id } });
    if (!income) throw new NotFoundException(`Fuel income with id ${id} not found`);
    await this.incomeRepository.remove(income);
  }

  async createExpense(dto: CreateFuelExpenseDto, userId: string): Promise<FuelExpense> {
    const balance = await this.getCurrentBalance();
    if (dto.liters > balance) {
      throw new BadRequestException(
        `Yetarli salyarka yo'q. Mavjud: ${balance} litr, so'ralgan: ${dto.liters} litr`,
      );
    }

    const expense = this.expenseRepository.create({
      ...dto,
      destination: dto.destination.trim(),
      createdById: userId,
    });
    return this.expenseRepository.save(expense);
  }

  async findAllExpenses(query: FuelQueryDto): Promise<FuelExpense[]> {
    const qb = this.expenseRepository.createQueryBuilder('e').orderBy('e.date', 'DESC').addOrderBy('e.createdAt', 'DESC');
    if (query.date) qb.andWhere('e.date = :date', { date: query.date });
    if (query.dateFrom) qb.andWhere('e.date >= :dateFrom', { dateFrom: query.dateFrom });
    if (query.dateTo) qb.andWhere('e.date <= :dateTo', { dateTo: query.dateTo });
    return qb.getMany();
  }

  async removeExpense(id: string): Promise<void> {
    const expense = await this.expenseRepository.findOne({ where: { id } });
    if (!expense) throw new NotFoundException(`Fuel expense with id ${id} not found`);
    await this.expenseRepository.remove(expense);
  }

  async getCurrentBalance(): Promise<number> {
    const [incomeSum, expenseSum] = await Promise.all([
      this.incomeRepository.createQueryBuilder('i').select('COALESCE(SUM(i.liters), 0)', 'total').getRawOne(),
      this.expenseRepository.createQueryBuilder('e').select('COALESCE(SUM(e.liters), 0)', 'total').getRawOne(),
    ]);
    return Number(incomeSum.total) - Number(expenseSum.total);
  }

  // Day-by-day ledger: for every date that had any activity, the day's totals
  // and the running balance at the end of that day. dateFrom/dateTo narrow the
  // returned rows but the running balance is always computed from day one, so
  // filtering never skews the "qolgan" figure.
  async getDailyLedger(dateFrom?: string, dateTo?: string) {
    const [incomes, expenses] = await Promise.all([
      this.incomeRepository.find({ order: { date: 'ASC' } }),
      this.expenseRepository.find({ order: { date: 'ASC' } }),
    ]);

    const groupByDate = <T extends { date: string }>(items: T[]): Map<string, T[]> => {
      const m = new Map<string, T[]>();
      for (const item of items) {
        if (!m.has(item.date)) m.set(item.date, []);
        m.get(item.date)!.push(item);
      }
      return m;
    };

    const incomeByDate = groupByDate(incomes);
    const expenseByDate = groupByDate(expenses);
    const allDates = Array.from(new Set([...incomeByDate.keys(), ...expenseByDate.keys()])).sort();

    let running = 0;
    const ledger = allDates.map((date) => {
      const dayIncomes = incomeByDate.get(date) || [];
      const dayExpenses = expenseByDate.get(date) || [];
      const incomeLiters = dayIncomes.reduce((s, x) => s + Number(x.liters), 0);
      const expenseLiters = dayExpenses.reduce((s, x) => s + Number(x.liters), 0);
      running += incomeLiters - expenseLiters;
      return {
        date,
        incomeLiters,
        expenseLiters,
        balance: running,
      };
    });

    return ledger.filter((row) => (!dateFrom || row.date >= dateFrom) && (!dateTo || row.date <= dateTo)).reverse();
  }
}
