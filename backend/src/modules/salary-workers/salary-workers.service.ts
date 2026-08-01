import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSalaryAdvanceDto } from './dto/create-salary-advance.dto';
import { CreateSalaryWorkerDto } from './dto/create-salary-worker.dto';
import { SalaryWorkerQueryDto } from './dto/salary-worker-query.dto';
import { UpdateSalaryWorkerDto } from './dto/update-salary-worker.dto';
import { SalaryAdvance } from './entities/salary-advance.entity';
import { SalaryWorker } from './entities/salary-worker.entity';

@Injectable()
export class SalaryWorkersService {
  constructor(
    @InjectRepository(SalaryWorker)
    private readonly workerRepository: Repository<SalaryWorker>,
    @InjectRepository(SalaryAdvance)
    private readonly advanceRepository: Repository<SalaryAdvance>,
  ) {}

  async create(dto: CreateSalaryWorkerDto, userId: string): Promise<SalaryWorker> {
    const salaryAmount = Number(dto.salaryAmount);
    const worker = this.workerRepository.create({
      fullName: dto.fullName.trim(),
      month: dto.month,
      salaryAmount,
      paidAmount: 0,
      remainingAmount: salaryAmount,
      notes: dto.notes,
      createdById: userId,
    });
    return this.workerRepository.save(worker);
  }

  async findAll(query: SalaryWorkerQueryDto): Promise<SalaryWorker[]> {
    const qb = this.workerRepository
      .createQueryBuilder('w')
      .leftJoinAndSelect('w.advances', 'advances')
      .orderBy('w.fullName', 'ASC')
      .addOrderBy('advances.date', 'DESC');

    if (query.month) qb.andWhere('w.month = :month', { month: query.month });
    if (query.search) qb.andWhere('w.fullName ILIKE :search', { search: `%${query.search}%` });

    return qb.getMany();
  }

  async findOne(id: string): Promise<SalaryWorker> {
    const worker = await this.workerRepository.findOne({
      where: { id },
      relations: ['advances'],
      order: { advances: { date: 'DESC' } },
    });
    if (!worker) throw new NotFoundException(`Salary worker with id ${id} not found`);
    return worker;
  }

  async update(id: string, dto: UpdateSalaryWorkerDto): Promise<SalaryWorker> {
    const worker = await this.findOne(id);
    const salaryAmount = dto.salaryAmount !== undefined ? Number(dto.salaryAmount) : Number(worker.salaryAmount);
    const remainingAmount = salaryAmount - Number(worker.paidAmount);

    await this.workerRepository.update(id, {
      fullName: dto.fullName?.trim() ?? worker.fullName,
      month: dto.month ?? worker.month,
      salaryAmount,
      remainingAmount,
      notes: dto.notes ?? worker.notes,
    });
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const worker = await this.findOne(id);
    await this.workerRepository.remove(worker);
  }

  async addAdvance(workerId: string, dto: CreateSalaryAdvanceDto, userId: string): Promise<SalaryAdvance> {
    const worker = await this.findOne(workerId);

    const advance = this.advanceRepository.create({
      worker,
      amount: dto.amount,
      date: dto.date,
      description: dto.description,
      createdById: userId,
    });
    await this.advanceRepository.save(advance);

    const paidAmount = Number(worker.paidAmount) + Number(dto.amount);
    const remainingAmount = Number(worker.salaryAmount) - paidAmount;
    // .update() instead of .save(worker): worker.advances was loaded before this
    // insert, so saving the parent entity directly would make TypeORM diff its
    // stale in-memory collection against the DB and nullify the new advance's
    // worker_id, thinking it had been removed from the relation.
    await this.workerRepository.update(workerId, { paidAmount, remainingAmount });

    return advance;
  }

  async removeAdvance(workerId: string, advanceId: string): Promise<void> {
    const worker = await this.findOne(workerId);
    const advance = await this.advanceRepository.findOne({
      where: { id: advanceId, worker: { id: workerId } },
    });
    if (!advance) throw new NotFoundException(`Advance with id ${advanceId} not found`);

    await this.advanceRepository.remove(advance);

    const paidAmount = Math.max(0, Number(worker.paidAmount) - Number(advance.amount));
    const remainingAmount = Number(worker.salaryAmount) - paidAmount;
    await this.workerRepository.update(workerId, { paidAmount, remainingAmount });
  }
}
