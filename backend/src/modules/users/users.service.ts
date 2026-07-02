import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepository.findOne({
      where: { username: createUserDto.username },
    });
    if (existing) {
      throw new BadRequestException('Username already exists');
    }

    const passwordHash = await bcrypt.hash(
      createUserDto.password,
      parseInt(process.env.BCRYPT_ROUNDS || '10'),
    );

    const user = this.usersRepository.create({
      fullName: createUserDto.fullName,
      phone: createUserDto.phone,
      username: createUserDto.username,
      passwordHash,
      role: createUserDto.role,
    });

    return this.usersRepository.save(user);
  }

  async findAll(paginationDto: PaginationDto) {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'DESC' } = paginationDto;
    const skip = (page - 1) * limit;

    const qb = this.usersRepository.createQueryBuilder('user');

    if (search) {
      qb.where(
        'user.fullName ILIKE :search OR user.username ILIKE :search OR user.phone ILIKE :search',
        { search: `%${search}%` },
      );
    }

    qb.orderBy(`user.${sortBy}`, sortOrder as 'ASC' | 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    return user;
  }

  async findByUsername(username: string): Promise<User> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (updateUserDto.password) {
      user.passwordHash = await bcrypt.hash(
        updateUserDto.password,
        parseInt(process.env.BCRYPT_ROUNDS || '10'),
      );
    }

    if (updateUserDto.fullName !== undefined) user.fullName = updateUserDto.fullName;
    if (updateUserDto.phone !== undefined) user.phone = updateUserDto.phone;
    if (updateUserDto.role !== undefined) user.role = updateUserDto.role;
    if (updateUserDto.isActive !== undefined) user.isActive = updateUserDto.isActive;

    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
  }

  async updateRefreshToken(id: string, refreshToken: string | null): Promise<void> {
    const hashed = refreshToken
      ? await bcrypt.hash(refreshToken, parseInt(process.env.BCRYPT_ROUNDS || '10'))
      : null;
    await this.usersRepository.update(id, { refreshToken: hashed });
  }
}
