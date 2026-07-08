import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaymentType } from '../../common/enums/payment-type.enum';
import { Sale } from '../sales/entities/sale.entity';
import { CreateDebtPaymentDto } from './dto/create-debt-payment.dto';
import { CreateDebtorDto } from './dto/create-debtor.dto';
import { UpdateDebtorDto } from './dto/update-debtor.dto';
import { DebtPayment } from './entities/debt-payment.entity';
import { Debtor } from './entities/debtor.entity';

@Injectable()
export class DebtorsService {
  constructor(
    @InjectRepository(Debtor)
    private readonly debtorRepository: Repository<Debtor>,
    @InjectRepository(DebtPayment)
    private readonly debtPaymentRepository: Repository<DebtPayment>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createDebtorDto: CreateDebtorDto): Promise<Debtor> {
    const debtor = this.debtorRepository.create(createDebtorDto);
    return this.debtorRepository.save(debtor);
  }

  async createOrUpdateDebt(data: {
    fullName: string;
    phone?: string;
    amount: number;
    saleId: string;
  }): Promise<Debtor> {
    let debtor: Debtor;

    if (data.phone) {
      debtor = await this.debtorRepository.findOne({ where: { phone: data.phone } });
    }

    if (!debtor && data.fullName) {
      debtor = await this.debtorRepository.findOne({ where: { fullName: data.fullName } });
    }

    if (!debtor) {
      debtor = this.debtorRepository.create({
        fullName: data.fullName,
        phone: data.phone,
        totalDebt: 0,
        paidAmount: 0,
        remainingDebt: 0,
        isPaid: false,
      });
      debtor = await this.debtorRepository.save(debtor);
    } else {
      debtor.fullName = data.fullName || debtor.fullName;
      debtor.phone = data.phone || debtor.phone;
      debtor = await this.debtorRepository.save(debtor);
    }

    return this.recalculateDebtorDebt(debtor);
  }

  async syncDebtForSaleCustomer(fullName?: string, phone?: string): Promise<void> {
    const debtor = await this.findDebtorByCustomer(fullName, phone);
    if (debtor) await this.recalculateDebtorDebt(debtor);
  }

  async findAll(paginationDto: PaginationDto) {
    await this.recalculateAllDebtors();

    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = paginationDto;
    const skip = (page - 1) * limit;

    const qb = this.debtorRepository.createQueryBuilder('debtor');

    if (search) {
      qb.where('debtor.fullName ILIKE :search OR debtor.phone ILIKE :search', {
        search: `%${search}%`,
      });
    }

    qb.orderBy(`debtor.${sortBy}`, sortOrder as 'ASC' | 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Debtor> {
    const debtor = await this.debtorRepository.findOne({
      where: { id },
      relations: ['payments'],
    });
    if (!debtor) throw new NotFoundException(`Debtor with id ${id} not found`);
    return debtor;
  }

  async update(id: string, updateDebtorDto: UpdateDebtorDto): Promise<Debtor> {
    const debtor = await this.findOne(id);
    Object.assign(debtor, updateDebtorDto);
    return this.debtorRepository.save(debtor);
  }

  async remove(id: string): Promise<void> {
    const debtor = await this.findOne(id);
    await this.debtorRepository.remove(debtor);
  }

  async addPayment(
    id: string,
    createPaymentDto: CreateDebtPaymentDto,
    userId: string,
  ): Promise<DebtPayment> {
    const debtor = await this.findOne(id);

    if (debtor.isPaid) {
      throw new BadRequestException('This debtor has already paid all debts');
    }

    const remainingDebt = Number(debtor.remainingDebt);
    if (createPaymentDto.amount > remainingDebt) {
      throw new BadRequestException(
        `Payment amount (${createPaymentDto.amount}) exceeds remaining debt (${remainingDebt})`,
      );
    }

    const payment = this.debtPaymentRepository.create({
      debtorId: id,
      amount: createPaymentDto.amount,
      description: createPaymentDto.description,
      date: createPaymentDto.date,
      createdById: userId,
    });
    await this.debtPaymentRepository.save(payment);

    debtor.paidAmount = Number(debtor.paidAmount) + createPaymentDto.amount;
    debtor.remainingDebt = Number(debtor.totalDebt) - Number(debtor.paidAmount);
    debtor.isPaid = debtor.remainingDebt <= 0;
    await this.debtorRepository.save(debtor);

    return payment;
  }

  async getPayments(id: string, paginationDto: PaginationDto) {
    await this.findOne(id);
    const { page = 1, limit = 20 } = paginationDto;
    const skip = (page - 1) * limit;

    const [data, total] = await this.debtPaymentRepository.findAndCount({
      where: { debtorId: id },
      relations: ['createdBy'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getTotalDebtStats() {
    await this.recalculateAllDebtors();

    const result = await this.debtorRepository
      .createQueryBuilder('debtor')
      .select('COUNT(*)', 'totalDebtors')
      .addSelect('SUM(debtor.totalDebt)', 'totalDebt')
      .addSelect('SUM(debtor.paidAmount)', 'totalPaid')
      .addSelect('SUM(debtor.remainingDebt)', 'totalRemainingDebt')
      .getRawOne();

    const unpaidDebtors = await this.debtorRepository.count({ where: { isPaid: false } });

    return {
      totalDebtors: parseInt(result.totalDebtors) || 0,
      totalDebt: parseFloat(result.totalDebt) || 0,
      totalPaid: parseFloat(result.totalPaid) || 0,
      totalRemainingDebt: parseFloat(result.totalRemainingDebt) || 0,
      unpaidDebtors,
    };
  }

  private async findDebtorByCustomer(fullName?: string, phone?: string): Promise<Debtor | null> {
    if (phone) {
      const byPhone = await this.debtorRepository.findOne({ where: { phone } });
      if (byPhone) return byPhone;
    }

    if (fullName) {
      return this.debtorRepository.findOne({ where: { fullName } });
    }

    return null;
  }

  private async recalculateAllDebtors(): Promise<void> {
    const debtors = await this.debtorRepository.find();
    if (!debtors.length) return;

    const saleRepo = this.dataSource.getRepository(Sale);
    const debtSales = await saleRepo.find({
      where: { paymentType: PaymentType.DEBT },
      select: {
        customerName: true,
        customerPhone: true,
        totalAmount: true,
      },
    });

    const totals = new Map<string, number>();
    for (const sale of debtSales) {
      const key = this.debtCustomerKey(sale.customerName, sale.customerPhone);
      totals.set(key, (totals.get(key) || 0) + Number(sale.totalAmount || 0));
    }

    const changed: Debtor[] = [];
    for (const debtor of debtors) {
      const totalDebt = totals.get(this.debtCustomerKey(debtor.fullName, debtor.phone)) || 0;
      const paidAmount = Number(debtor.paidAmount || 0);
      const remainingDebt = Math.max(0, totalDebt - paidAmount);
      const isPaid = remainingDebt <= 0;

      if (
        Number(debtor.totalDebt || 0) !== totalDebt ||
        Number(debtor.remainingDebt || 0) !== remainingDebt ||
        debtor.isPaid !== isPaid
      ) {
        debtor.totalDebt = totalDebt;
        debtor.remainingDebt = remainingDebt;
        debtor.isPaid = isPaid;
        changed.push(debtor);
      }
    }

    if (changed.length) await this.debtorRepository.save(changed);
  }

  private async recalculateDebtorDebt(debtor: Debtor): Promise<Debtor> {
    const saleRepo = this.dataSource.getRepository(Sale);
    const qb = saleRepo
      .createQueryBuilder('sale')
      .select('COALESCE(SUM(sale.totalAmount), 0)', 'total')
      .where('sale.paymentType = :paymentType', { paymentType: PaymentType.DEBT });

    if (debtor.phone) {
      qb.andWhere('sale.customerPhone = :phone', { phone: debtor.phone });
    } else {
      qb.andWhere('sale.customerName = :fullName', { fullName: debtor.fullName });
    }

    const result = await qb.getRawOne<{ total: string }>();
    const totalDebt = Number(result?.total || 0);
    const paidAmount = Number(debtor.paidAmount || 0);

    debtor.totalDebt = totalDebt;
    debtor.remainingDebt = Math.max(0, totalDebt - paidAmount);
    debtor.isPaid = debtor.remainingDebt <= 0;

    return this.debtorRepository.save(debtor);
  }

  private debtCustomerKey(fullName?: string, phone?: string): string {
    const normalizedPhone = (phone || '').trim();
    if (normalizedPhone) return `phone:${normalizedPhone}`;
    return `name:${(fullName || 'Unknown').trim()}`;
  }
}
