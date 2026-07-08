import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ExpenseCategory } from '../../common/enums/expense-category.enum';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { Expense } from './entities/expense.entity';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  async create(createExpenseDto: CreateExpenseDto, userId: string): Promise<Expense> {
    const expense = this.expenseRepository.create({
      ...createExpenseDto,
      createdById: userId,
    });
    return this.expenseRepository.save(expense);
  }

  async findAll(paginationDto: PaginationDto & { category?: ExpenseCategory }) {
    const {
      page = 1,
      limit = 20,
      search,
      dateFrom,
      dateTo,
      category,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = paginationDto;
    const skip = (page - 1) * limit;

    const qb = this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoinAndSelect('expense.createdBy', 'user');

    if (search) {
      qb.where('expense.description ILIKE :search OR expense.category::text ILIKE :search', {
        search: `%${search}%`,
      });
    }
    if (dateFrom) qb.andWhere('expense.date >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('expense.date <= :dateTo', { dateTo });
    if (category) qb.andWhere('expense.category = :category', { category });

    qb.orderBy(`expense.${sortBy}`, sortOrder as 'ASC' | 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Expense> {
    const expense = await this.expenseRepository.findOne({
      where: { id },
      relations: ['createdBy'],
    });
    if (!expense) throw new NotFoundException(`Expense with id ${id} not found`);
    return expense;
  }

  async update(id: string, updateExpenseDto: UpdateExpenseDto): Promise<Expense> {
    const expense = await this.findOne(id);
    Object.assign(expense, updateExpenseDto);
    return this.expenseRepository.save(expense);
  }

  async remove(id: string): Promise<void> {
    const expense = await this.findOne(id);
    await this.expenseRepository.remove(expense);
  }

  async getExpensesByDateRange(dateFrom: string, dateTo: string): Promise<Expense[]> {
    return this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.date >= :dateFrom', { dateFrom })
      .andWhere('expense.date <= :dateTo', { dateTo })
      .getMany();
  }
}
