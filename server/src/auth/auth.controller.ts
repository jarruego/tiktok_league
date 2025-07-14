import { Body, Controller, Post, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Endpoint de login: recibe username y password, devuelve JWT
  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    const user = await this.authService.validateUser(body.username, body.password);
    if (!user) throw new UnauthorizedException('Credenciales incorrectas');
    return this.authService.login(user);
  }

  // Endpoint para login con TikTok OAuth
  @Post('tiktok')
  async tiktokLogin(@Body() body: { code: string }) {
    return this.authService.loginWithTikTok(body.code);
  }

  // Endpoint para login con Google OAuth
  @Post('google')
  async googleLogin(@Body() body: { token: string }) {
    return this.authService.loginWithGoogle(body.token);
  }

  // Endpoint de registro clásico
  @Post('register')
  async register(@Body() body: { username: string; password: string; email?: string }) {
    return this.authService.register(body);
  }
}
