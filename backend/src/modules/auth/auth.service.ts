import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const user = await this.usersService.create({
      fullName: registerDto.fullName,
      phone: registerDto.phone,
      username: registerDto.username,
      password: registerDto.password,
      role: registerDto.role,
    });

    const tokens = await this.generateTokens(user.id, user.username, user.role);
    await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

    const { passwordHash, refreshToken, ...userResponse } = user as any;
    return { user: userResponse, ...tokens };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByUsername(loginDto.username);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Your account has been deactivated');

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(user.id, user.username, user.role);
    await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

    const { passwordHash, refreshToken, ...userResponse } = user as any;
    return { user: userResponse, ...tokens };
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.usersService.findOne(userId);
    if (!user || !user.refreshToken) throw new UnauthorizedException('Access denied');

    const isRefreshTokenValid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isRefreshTokenValid) throw new UnauthorizedException('Access denied');

    const tokens = await this.generateTokens(user.id, user.username, user.role);
    await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async refreshFromToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
      return this.refresh(payload.sub, refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
  }

  async logout(userId: string) {
    await this.usersService.updateRefreshToken(userId, null);
    return { message: 'Logged out successfully' };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.usersService.update(userId, { fullName: dto.fullName });
    const { passwordHash, refreshToken, ...profile } = user as any;
    return profile;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findOne(userId);
    const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Joriy parol noto\'g\'ri');
    await this.usersService.update(userId, { password: dto.newPassword });
    return { message: 'Parol muvaffaqiyatli o\'zgartirildi' };
  }

  private async generateTokens(userId: string, username: string, role: string) {
    const payload = { sub: userId, username, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: this.configService.get<string>('jwt.expiresIn'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
