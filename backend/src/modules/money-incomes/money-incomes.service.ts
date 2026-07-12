import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { MoneyIncomeSource } from '../../common/enums/money-income-source.enum';
import { CreateMoneyIncomeDto } from './dto/create-money-income.dto';
import { UpdateMoneyIncomeDto } from './dto/update-money-income.dto';
import { MoneyIncome } from './entities/money-income.entity';

@Injectable()
export class MoneyIncomesService {
  constructor(
    @InjectRepository(MoneyIncome)
    private readonly moneyIncomeRepository: Repository<MoneyIncome>,
  ) {}

  async create(dto: CreateMoneyIncomeDto, userId: string): Promise<MoneyIncome> {
    const income = this.moneyIncomeRepository.create({ ...dto, createdById: userId });
    return this.moneyIncomeRepository.save(income);
  }

  async findAll(paginationDto: PaginationDto & { source?: MoneyIncomeSource }) {
    const { page = 1, limit = 20, search, dateFrom, dateTo, source, sortBy = 'date', sortOrder = 'DESC' } = paginationDto;
    const skip = (page - 1) * limit;

    const qb = this.moneyIncomeRepository
      .createQueryBuilder('mi')
      .leftJoinAndSelect('mi.createdBy', 'user')
      .orderBy(`mi.${sortBy}`, sortOrder as 'ASC' | 'DESC')
      .skip(skip)
      .take(limit);

    if (search) qb.andWhere('mi.fromWhom ILIKE :s OR mi.description ILIKE :s', { s: `%${search}%` });
    if (dateFrom) qb.andWhere('mi.date >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('mi.date <= :dateTo', { dateTo });
    if (source) {
      qb.andWhere('mi.source = :source', { source });
    } else {
      // FIRM_DEPOSIT / FIRM_OLD_DEBT are managed exclusively on the Perechisleniya page
      // and shouldn't clutter the general Kirimlar ledger unless explicitly filtered for.
      qb.andWhere('mi.source NOT IN (:...excluded)', { excluded: [MoneyIncomeSource.FIRM_DEPOSIT, MoneyIncomeSource.FIRM_OLD_DEBT] });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string): Promise<MoneyIncome> {
    const income = await this.moneyIncomeRepository.findOne({ where: { id }, relations: ['createdBy'] });
    if (!income) throw new NotFoundException(`Money income ${id} not found`);
    return income;
  }

  async update(id: string, dto: UpdateMoneyIncomeDto, userId: string): Promise<MoneyIncome> {
    const income = await this.findOne(id);
    Object.assign(income, dto);
    return this.moneyIncomeRepository.save(income);
  }

  async remove(id: string): Promise<void> {
    const income = await this.findOne(id);
    await this.moneyIncomeRepository.remove(income);
  }
}
