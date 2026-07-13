import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaymentType } from '../../common/enums/payment-type.enum';
import { SalesService } from '../sales/sales.service';
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
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @Inject(forwardRef(() => SalesService))
    private readonly salesService: SalesService,
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
    date?: string;
  }): Promise<Debtor> {
    let debtor: Debtor;

    if (data.phone) {
      debtor = await this.debtorRepository.findOne({ where: { phone: data.phone } });
    }

    if (!debtor && data.fullName) {
      debtor = await this.debtorRepository.findOne({ where: { fullName: data.fullName } });
    }

    if (debtor) {
      debtor.totalDebt = Number(debtor.totalDebt) + data.amount;
      debtor.remainingDebt = Number(debtor.totalDebt) - Number(debtor.paidAmount);
      debtor.isPaid = debtor.remainingDebt <= 0;
      if (data.date && (!debtor.lastDebtDate || data.date > debtor.lastDebtDate)) {
        debtor.lastDebtDate = data.date;
      }
    } else {
      debtor = this.debtorRepository.create({
        fullName: data.fullName,
        phone: data.phone,
        totalDebt: data.amount,
        paidAmount: 0,
        remainingDebt: data.amount,
        isPaid: false,
        lastDebtDate: data.date,
      });
    }

    return this.debtorRepository.save(debtor);
  }

  async findAll(paginationDto: PaginationDto) {
    await this.syncDebtSales();

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

    const where = debtor.phone
      ? { paymentType: PaymentType.DEBT, customerPhone: debtor.phone }
      : { paymentType: PaymentType.DEBT, customerName: debtor.fullName };
    const linkedSales = await this.saleRepository.find({ where });
    for (const sale of linkedSales) {
      await this.salesService.remove(sale.id, 'system', true);
    }

    await this.debtorRepository.remove(debtor);
  }

  async removeSaleDebt(customerName: string, phone: string | undefined): Promise<void> {
    let debtor = phone
      ? await this.debtorRepository.findOne({ where: { phone } })
      : null;
    if (!debtor) {
      debtor = await this.debtorRepository.findOne({ where: { fullName: customerName } });
    }
    if (!debtor) return;

    // Sale is already deleted from DB at this point — count remaining debt sales
    const remainingSales = await this.saleRepository.find({
      where: phone
        ? { paymentType: PaymentType.DEBT, customerPhone: phone }
        : { paymentType: PaymentType.DEBT, customerName: debtor.fullName },
    });

    if (remainingSales.length === 0) {
      await this.debtorRepository.remove(debtor);
    } else {
      const newTotal = remainingSales.reduce((s, sale) => s + Number(sale.totalAmount), 0);
      debtor.totalDebt = newTotal;
      debtor.remainingDebt = Math.max(0, newTotal - Number(debtor.paidAmount));
      debtor.isPaid = debtor.remainingDebt <= 0;
      await this.debtorRepository.save(debtor);
    }
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
    await this.syncDebtSales();

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

  private async syncDebtSales(): Promise<void> {
    const sales = await this.saleRepository.find({
      where: { paymentType: PaymentType.DEBT },
      order: { createdAt: 'ASC' },
    });

    const groups = new Map<string, { fullName: string; phone?: string; amount: number; lastDebtDate?: string }>();

    for (const sale of sales) {
      const fullName = (sale.customerName || 'Unknown').trim() || 'Unknown';
      const phone = sale.customerPhone?.trim() || undefined;
      const key = phone ? `phone:${phone}` : `name:${fullName.toLowerCase()}`;
      const group = groups.get(key) || { fullName, phone, amount: 0, lastDebtDate: undefined };
      group.amount += Number(sale.totalAmount || 0);
      if (sale.date && (!group.lastDebtDate || sale.date > group.lastDebtDate)) {
        group.lastDebtDate = sale.date;
      }
      groups.set(key, group);
    }

    // Delete orphaned debtors (no remaining debt sales)
    const allDebtors = await this.debtorRepository.find();
    for (const debtor of allDebtors) {
      const phone = debtor.phone?.trim() || undefined;
      const key = phone
        ? `phone:${phone}`
        : `name:${(debtor.fullName || '').toLowerCase()}`;
      if (!groups.has(key)) {
        await this.debtorRepository.remove(debtor);
      }
    }

    for (const group of groups.values()) {
      let debtor = group.phone
        ? await this.debtorRepository.findOne({ where: { phone: group.phone } })
        : null;

      if (!debtor) {
        debtor = await this.debtorRepository.findOne({ where: { fullName: group.fullName } });
      }

      if (!debtor) {
        debtor = this.debtorRepository.create({
          fullName: group.fullName,
          phone: group.phone,
          totalDebt: group.amount,
          paidAmount: 0,
          remainingDebt: group.amount,
          isPaid: group.amount <= 0,
          lastDebtDate: group.lastDebtDate,
        });
      } else {
        debtor.fullName = debtor.fullName || group.fullName;
        debtor.phone = debtor.phone || group.phone;
        debtor.totalDebt = group.amount;
        debtor.remainingDebt = group.amount - Number(debtor.paidAmount || 0);
        debtor.isPaid = debtor.remainingDebt <= 0;
        debtor.lastDebtDate = group.lastDebtDate;
      }

      await this.debtorRepository.save(debtor);
    }
  }

}
