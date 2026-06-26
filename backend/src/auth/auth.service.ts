import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
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
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { channels: { orderBy: { createdAt: 'asc' }, take: 1 } },
    });
    if (!user || !(await this.passwordService.verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const session = await this.createSession(user.id);

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      user: toAuthUser(user),
    };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const displayName = dto.displayName.trim();
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await this.passwordService.hashPassword(dto.password);
    const { user, channel } = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          displayName,
          passwordHash,
        },
      });
      const createdChannel = await tx.channel.create({
        data: {
          ownerId: createdUser.id,
          name: displayName,
          description: '',
        },
      });

      return { user: createdUser, channel: createdChannel };
    });
    const session = await this.createSession(user.id);

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      user: toAuthUser({ ...user, channels: [channel] }),
    };
  }

  async getCurrentUser(request: Pick<Request, 'headers'>): Promise<AuthUser | null> {
    const token = this.readSessionToken(request);
    if (!token) {
      return null;
    }

    const session = await this.prisma.session.findUnique({
      where: { token },
      include: { user: { include: { channels: { orderBy: { createdAt: 'asc' }, take: 1 } } } },
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

  private createSession(userId: string) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    return this.prisma.session.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }
}

export function toAuthUser(user: {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  channels?: Array<{ id: string }>;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    channelId: user.channels?.[0]?.id,
  };
}
