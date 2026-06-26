import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { PasswordService } from './password.service';
import type { AuthUser } from './auth.types';

export const SESSION_COOKIE_NAME = 'jjobtub_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await this.passwordService.verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      user: toAuthUser(user),
    };
  }

  async getCurrentUser(request: Pick<Request, 'headers'>): Promise<AuthUser | null> {
    const token = this.readSessionToken(request);
    if (!token) {
      return null;
    }

    const session = await this.prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return toAuthUser(session.user);
  }

  async logout(request: Pick<Request, 'headers'>) {
    const token = this.readSessionToken(request);
    if (token) {
      await this.prisma.session.deleteMany({ where: { token } });
    }
  }

  readSessionToken(request: Pick<Request, 'headers'>) {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) {
      return '';
    }

    return cookieHeader
      .split(';')
      .map((cookie) => cookie.trim())
      .map((cookie) => cookie.split('='))
      .find(([name]) => name === SESSION_COOKIE_NAME)?.[1] ?? '';
  }
}

export function toAuthUser(user: {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}

