import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { WorkerPaymentCategory } from '../../common/enums/worker-payment-category.enum';
import { CreateWorkerPaymentDto } from './dto/create-worker-payment.dto';
import { UpdateWorkerPaymentDto } from './dto/update-worker-payment.dto';
import { WorkerPayment } from './entities/worker-payment.entity';

@Injectable()
export class WorkerPaymentsService {
  constructor(
    @InjectRepository(WorkerPayment)
    private readonly workerPaymentRepository: Repository<WorkerPayment>,
  ) {}

  async create(dto: CreateWorkerPaymentDto, userId: string): Promise<WorkerPayment> {
    const debt = Number(dto.debtFromPreviousMonth || 0);
    const amount = Number(dto.amount);
    const paid = Number(dto.paidAmount || 0);
    const remainingDebt = debt + amount - paid;

    const payment = this.workerPaymentRepository.create({
      ...dto,
      debtFromPreviousMonth: debt,
      paidAmount: paid,
      remainingDebt: remainingDebt < 0 ? 0 : remainingDebt,
      createdById: userId,
    });
    return this.workerPaymentRepository.save(payment);
  }

  async findAll(paginationDto: PaginationDto & { category?: WorkerPaymentCategory; month?: string }) {
    const { page = 1, limit = 20, search, dateFrom, dateTo, category, month, sortBy = 'date', sortOrder = 'DESC' } = paginationDto;
    const skip = (page - 1) * limit;

    const qb = this.workerPaymentRepository
      .createQueryBuilder('wp')
      .leftJoinAndSelect('wp.createdBy', 'user')
      .orderBy(`wp.${sortBy}`, sortOrder as 'ASC' | 'DESC')
      .skip(skip)
      .take(limit);

    if (search) qb.andWhere('wp.workerName ILIKE :s OR wp.description ILIKE :s', { s: `%${search}%` });
    if (dateFrom) qb.andWhere('wp.date >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('wp.date <= :dateTo', { dateTo });
    if (category) qb.andWhere('wp.category = :category', { category });
    if (month) qb.andWhere('wp.month = :month', { month });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string): Promise<WorkerPayment> {
    const wp = await this.workerPaymentRepository.findOne({ where: { id }, relations: ['createdBy'] });
    if (!wp) throw new NotFoundException(`Worker payment ${id} not found`);
    return wp;
  }

  async update(id: string, dto: UpdateWorkerPaymentDto): Promise<WorkerPayment> {
    const wp = await this.findOne(id);
    Object.assign(wp, dto);
    const debt = Number(wp.debtFromPreviousMonth || 0);
    const amount = Number(wp.amount);
    const paid = Number(wp.paidAmount || 0);
    wp.remainingDebt = Math.max(0, debt + amount - paid);
    return this.workerPaymentRepository.save(wp);
  }

  async remove(id: string): Promise<void> {
    const wp = await this.findOne(id);
    await this.workerPaymentRepository.remove(wp);
  }

  async getReport(month?: number, year?: number, dateFrom?: string, dateTo?: string) {
    const qb = this.workerPaymentRepository.createQueryBuilder('wp');
    if (month) qb.andWhere('wp.month = :month', { month });
    if (year) qb.andWhere('wp.year = :year', { year });
    if (dateFrom) qb.andWhere('wp.date >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('wp.date <= :dateTo', { dateTo });

    const payments = await qb.getMany();

    const totalAmount = payments.reduce((s, x) => s + Number(x.amount), 0);
    const totalPaid = payments.reduce((s, x) => s + Number(x.paidAmount), 0);
    const totalDebt = payments.reduce((s, x) => s + Number(x.remainingDebt), 0);

    const workerNames = new Set(payments.map((p) => p.workerName));
    const totalWorkers = workerNames.size;

    const byCategory: Record<string, { count: number; amount: number; paid: number; debt: number }> = {};
    for (const p of payments) {
      if (!byCategory[p.category]) byCategory[p.category] = { count: 0, amount: 0, paid: 0, debt: 0 };
      byCategory[p.category].count += 1;
      byCategory[p.category].amount += Number(p.amount);
      byCategory[p.category].paid += Number(p.paidAmount);
      byCategory[p.category].debt += Number(p.remainingDebt);
    }

    return { totalWorkers, totalAmount, totalPaid, totalDebt, byCategory };
  }
}
