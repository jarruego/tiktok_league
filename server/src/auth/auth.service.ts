import { Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from './users.service';
import * as bcrypt from 'bcryptjs';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthService } from './google.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly googleAuthService: GoogleAuthService, // inyectar
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
  async login(user: any, extra: any = {}) {
    // Mapear team_id a teamId si viene en snake_case
    const teamId = user.teamId ?? user.team_id ?? null;
    const payload = { username: user.username, sub: user.id, role: user.role, teamId };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        teamId,
        ...extra
      }
    };
  }

  // Registro clásico
  async register({ username, password, email }: { username: string; password: string; email?: string }) {
    if (!username || !password) throw new Error('Usuario y contraseña requeridos');
    // Comprobar si ya existe el usuario
    const existing = await this.usersService.findByUsername(username);
    if (existing) throw new Error('El usuario ya existe');
    // Hashear contraseña
    const hashed = await bcrypt.hash(password, 10);
    // Crear usuario
    const user = await this.usersService.createFromRegister({ username, password: hashed, email });
    return this.login(user);
  }

  async loginWithTikTok(code: string) {
    const client_key = this.configService.get<string>('TIKTOK_CLIENT_KEY');
    const client_secret = this.configService.get<string>('TIKTOK_CLIENT_SECRET');
    const redirect_uri = this.configService.get<string>('TIKTOK_REDIRECT_URI');

    // Depuración extra
    console.log('--- TikTok OAuth Debug ---');
    console.log('Código recibido:', code);
    console.log('Redirect URI usado:', redirect_uri);
    if (!code || typeof code !== 'string' || code.length < 10) {
      console.error('El código recibido es inválido o está vacío:', code);
      throw new UnauthorizedException('El código de TikTok es inválido o está vacío.');
    }
    if (redirect_uri !== 'https://social-league-ivory.vercel.app/tiktok-callback') {
      console.error('El redirect_uri no coincide con el registrado en TikTok Developers:', redirect_uri);
      throw new UnauthorizedException('El redirect_uri no coincide con el registrado en TikTok Developers.');
    }

    // Detectar entorno sandbox para mostrar mensaje amigable
    const isSandbox = process.env.TIKTOK_CLIENT_KEY?.includes('sbawp') || process.env.NODE_ENV !== 'production';

    if (isSandbox) {
      // Simulación temporal para sandbox: usuario fijo de prueba con rol 'user' (solo en memoria)
      let user = await this.usersService.findByUsername('sandbox_tiktok_user');
      if (!user) {
        user = await this.usersService.createFromTikTok({ username: 'sandbox_tiktok_user' });
      }
      user.role = 'user'; // Forzar rol en memoria para la simulación
      const jwt = this.jwtService.sign({ username: user.username, sub: user.id, role: user.role });
      return {
        access_token: jwt,
        token: jwt,
        user,
        success: true
      };
    }

    // Usar el endpoint alternativo de TikTok para producción y sandbox
    const tokenEndpoint = 'https://open-api.tiktok.com/oauth/access_token/';

    // Log de variables de entorno
    console.log('TikTok env:', { client_key, client_secret, redirect_uri, code, isSandbox });
    // Log del body que se enviará a TikTok (como x-www-form-urlencoded)
    const tiktokBodyObj = {
      client_key: client_key || '',
      client_secret: client_secret || '',
      code: code || '',
      grant_type: 'authorization_code',
      redirect_uri: redirect_uri || '',
    };
    const tiktokBody = new URLSearchParams(tiktokBodyObj).toString();
    console.log('Body enviado a TikTok (urlencoded):', tiktokBody);
    // Depuración: mostrar cada parámetro por separado
    Object.entries(tiktokBodyObj).forEach(([key, value]) => {
      console.log(`Param ${key}:`, value);
    });

    try {
      // 1. Intercambiar code por access_token
      const tokenRes = await axios.post(tokenEndpoint, tiktokBody, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      // Log para depuración: respuesta completa de TikTok
      console.log('TikTok token response:', tokenRes.data);
      // Log de la respuesta completa (headers, status, etc.)
      console.log('Respuesta completa de TikTok:', {
        status: tokenRes.status,
        statusText: tokenRes.statusText,
        headers: tokenRes.headers,
        data: tokenRes.data
      });

      if (!tokenRes.data || !tokenRes.data.data || !tokenRes.data.data.access_token) {
        if (isSandbox) {
          // Mensaje especial para sandbox
          throw new UnauthorizedException('TikTok Sandbox: El flujo de login no puede completarse en modo Sandbox. El código y la integración son correctos, pero TikTok solo permite el flujo completo en producción.');
        }
        throw new UnauthorizedException('No se pudo obtener el access_token de TikTok');
      }
      const access_token = tokenRes.data.data.access_token;

      // 2. Obtener datos del usuario, incluyendo seguidores
      const userRes = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
        headers: { 'Authorization': `Bearer ${access_token}` },
        params: { fields: 'open_id,username,avatar_url,follower_count' }
      });
      const tiktokUser = userRes.data.data.user;

      // 3. Buscar o crear usuario en tu base de datos
      let user = await this.usersService.findByUsername(tiktokUser.open_id);
      if (!user) {
        // Buscar equipo is_bot mejor clasificado en la liga más alta posible (divisiones 1 a 5)
        let assignedTeam: any = undefined;
        for (let division = 1; division <= 5; division++) {
          const botTeams = await this.usersService.findBotTeamsByDivision(division);
          if (Array.isArray(botTeams) && botTeams.length > 0 && botTeams[0]?.id) {
            assignedTeam = botTeams[0];
            break;
          }
        }
        // Crear usuario nuevo con rol por defecto y asignar equipo si existe
        user = await this.usersService.createFromTikTok({
          username: tiktokUser.open_id,
          teamId: assignedTeam && assignedTeam.id ? assignedTeam.id : undefined
        });
        // Si se asignó un equipo bot, actualizarlo: is_bot=false y nombre=usuario TikTok
        if (assignedTeam && assignedTeam.id) {
          const newName = tiktokUser.username || tiktokUser.open_id || tiktokUser.displayName || tiktokUser.nickname || tiktokUser.unique_id || `Equipo de ${tiktokUser.open_id}`;
          await this.usersService.updateTeamBotAssignment({
            teamId: assignedTeam.id,
            isBot: false,
            name: newName
          });
        }
      }

      // 4. Generar JWT y devolver, incluyendo followers
      return this.login(user, { follower_count: tiktokUser.follower_count });
    } catch (err) {
      // Mostrar mensaje especial en sandbox
      if (isSandbox) {
        console.error('TikTok Sandbox error:', err?.response?.data || err);
        throw new UnauthorizedException('TikTok Sandbox: El flujo de login no puede completarse en modo Sandbox. El código y la integración son correctos, pero TikTok solo permite el flujo completo en producción.');
      }
      // Log detallado del error
      if (err.response) {
        console.error('Error en loginWithTikTok:', {
          status: err.response.status,
          statusText: err.response.statusText,
          headers: err.response.headers,
          data: err.response.data
        });
      } else {
        console.error('Error en loginWithTikTok (sin response):', err);
      }
      throw new UnauthorizedException('Error en login con TikTok');
    }
  }

  async loginWithGoogle(token: string) {
    const payload = await this.googleAuthService.verify(token);
    // Buscar usuario por email
    const email = payload.email || '';
    let user = await this.usersService.findByUsername(email);
    if (!user) {
      // Crear usuario nuevo
      user = await this.usersService.createFromGoogle({
        username: email,
        displayName: payload.name || undefined,
        avatar: payload.picture || undefined,
      });
    }
    return this.login(user);
  }
}
