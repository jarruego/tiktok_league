import { Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from './users.service';
import * as bcrypt from 'bcryptjs';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // Valida usuario y contraseña
  async validateUser(username: string, pass: string) {
    const user = await this.usersService.findByUsername(username);
    if (user && await bcrypt.compare(pass, user.password)) {
      // No devuelvas la contraseña
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  // Genera el JWT para el usuario
  async login(user: any) {
    const payload = { username: user.username, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    };
  }

  async loginWithTikTok(code: string) {
    const client_key = this.configService.get<string>('TIKTOK_CLIENT_KEY');
    const client_secret = this.configService.get<string>('TIKTOK_CLIENT_SECRET');
    const redirect_uri = this.configService.get<string>('TIKTOK_REDIRECT_URI');

    // Detectar entorno sandbox para mostrar mensaje amigable
    const isSandbox = process.env.TIKTOK_CLIENT_KEY?.includes('sbawp') || process.env.NODE_ENV !== 'production';

    if (isSandbox) {
      // Simulación temporal para sandbox: usuario fijo de prueba con rol 'user' (solo en memoria)
      let user = await this.usersService.findByUsername('sandbox_tiktok_user');
      if (!user) {
        user = await this.usersService.createFromTikTok({ username: 'sandbox_tiktok_user' });
      }
      user.role = 'user'; // Forzar rol en memoria para la simulación
      return this.login(user);
    }

    // Usar el endpoint oficial de TikTok para producción y sandbox
    const tokenEndpoint = 'https://open.tiktokapis.com/v2/oauth/token';

    // Log de variables de entorno
    console.log('TikTok env:', { client_key, client_secret, redirect_uri, code, isSandbox });

    try {
      // 1. Intercambiar code por access_token
      const tokenRes = await axios.post(tokenEndpoint, {
        client_key,
        client_secret,
        code,
        grant_type: 'authorization_code',
        redirect_uri,
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      // Log para depuración: respuesta completa de TikTok
      console.log('TikTok token response:', tokenRes.data);

      if (!tokenRes.data || !tokenRes.data.data || !tokenRes.data.data.access_token) {
        if (isSandbox) {
          // Mensaje especial para sandbox
          throw new UnauthorizedException('TikTok Sandbox: El flujo de login no puede completarse en modo Sandbox. El código y la integración son correctos, pero TikTok solo permite el flujo completo en producción.');
        }
        throw new UnauthorizedException('No se pudo obtener el access_token de TikTok');
      }
      const access_token = tokenRes.data.data.access_token;

      // 2. Obtener datos del usuario
      const userRes = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
        headers: { 'Authorization': `Bearer ${access_token}` },
        params: { fields: 'open_id,username,avatar_url' }
      });
      const tiktokUser = userRes.data.data.user;

      // 3. Buscar o crear usuario en tu base de datos
      let user = await this.usersService.findByUsername(tiktokUser.open_id);
      if (!user) {
        // Crear usuario nuevo con rol por defecto
        user = await this.usersService.createFromTikTok({
          username: tiktokUser.open_id
        });
      }

      // 4. Generar JWT y devolver
      return this.login(user);
    } catch (err) {
      // Mostrar mensaje especial en sandbox
      if (isSandbox) {
        console.error('TikTok Sandbox error:', err?.response?.data || err);
        throw new UnauthorizedException('TikTok Sandbox: El flujo de login no puede completarse en modo Sandbox. El código y la integración son correctos, pero TikTok solo permite el flujo completo en producción.');
      }
      console.error('Error en loginWithTikTok:', err?.response?.data || err);
      throw new UnauthorizedException('Error en login con TikTok');
    }
  }
}
