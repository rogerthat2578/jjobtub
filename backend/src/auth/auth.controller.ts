import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, SESSION_COOKIE_NAME } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(dto);
    response.cookie(SESSION_COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: result.expiresAt,
    });

    return { user: result.user };
  }

  @Get('me')
  async me(@Req() request: Request) {
    const user = await this.authService.getCurrentUser(request);
    if (!user) {
      throw new UnauthorizedException('Not logged in');
    }

    return { user };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(request);
    response.cookie(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: new Date(0),
    });

    return { ok: true };
  }
}
