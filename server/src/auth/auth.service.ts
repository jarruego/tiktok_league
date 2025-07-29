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

    console.log('--- TikTok OAuth Debug ---');
    console.log('Código recibido:', code?.substring(0, 20) + '...');
    console.log('Client Key (primeros 10 chars):', client_key?.substring(0, 10) + '...');
    console.log('Redirect URI:', redirect_uri);

    // Validaciones estrictas
    if (!code || typeof code !== 'string' || code.length < 10) {
      console.error('El código recibido es inválido:', code);
      throw new UnauthorizedException('El código de TikTok es inválido.');
    }
    if (!client_key || !client_secret || !redirect_uri) {
      console.error('Faltan variables de entorno TikTok');
      throw new UnauthorizedException('Configuración TikTok incompleta');
    }

    // Detectar entorno sandbox solo por client_key
    const isSandbox = client_key.includes('sbawp');
    console.log('Entorno detectado:', isSandbox ? 'Sandbox' : 'Production');

    if (isSandbox) {
      let user = await this.usersService.findByUsername('sandbox_tiktok_user');
      if (!user) {
        user = await this.usersService.createFromTikTok({ username: 'sandbox_tiktok_user' });
      }
      user.role = 'user';
      const jwt = this.jwtService.sign({ username: user.username, sub: user.id, role: user.role });
      return {
        access_token: jwt,
        token: jwt,
        user,
        success: true
      };
    }

    const tokenEndpoint = 'https://open.tiktokapis.com/v2/oauth/token/';

    try {
      // Crear el payload de forma estricta y sin repeticiones
      const params = new URLSearchParams();
      params.set('client_key', client_key);
      params.set('client_secret', client_secret);
      params.set('code', code);
      params.set('grant_type', 'authorization_code');
      params.set('redirect_uri', redirect_uri);

      // Debug: mostrar el payload final
      console.log('Payload TikTok:', params.toString());
      const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      console.log('Request headers:', headers);

      // Realizar petición con configuración mínima y sin parámetros extra
      const tokenRes = await axios.post(tokenEndpoint, params.toString(), {
        headers,
        timeout: 15000,
        validateStatus: (status) => status < 500
      });

      console.log('TikTok Response Status:', tokenRes.status);
      console.log('TikTok Response Data:', JSON.stringify(tokenRes.data, null, 2));

      // Verificar estructura de respuesta
      if (tokenRes.status !== 200) {
        console.error('TikTok returned non-200 status:', tokenRes.status, tokenRes.data);
        throw new UnauthorizedException(`TikTok OAuth error: ${tokenRes.status}`);
      }

      if (!tokenRes.data || tokenRes.data.error) {
        console.error('TikTok returned error:', tokenRes.data);
        throw new UnauthorizedException('TikTok OAuth failed: ' + (tokenRes.data?.data?.description || 'Unknown error'));
      }


      if (!tokenRes.data.access_token || !tokenRes.data.open_id) {
        console.error('TikTok response missing access_token or open_id:', tokenRes.data);
        throw new UnauthorizedException('TikTok did not return access_token or open_id');
      }

      const access_token = tokenRes.data.access_token;
      const open_id = tokenRes.data.open_id;

      // 2. Obtener datos del usuario (si quieres más info, pero open_id ya está)
      // Puedes omitir esta llamada si solo necesitas open_id
      let tiktokUser: any = { open_id };
      try {
        const userRes = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
          headers: { 'Authorization': `Bearer ${access_token}` },
          params: { fields: 'open_id,username,avatar_url,follower_count' },
          timeout: 10000
        });
        console.log('TikTok User Info RAW:', JSON.stringify(userRes.data, null, 2));
        if (userRes.data && userRes.data.data && userRes.data.data.user) {
          tiktokUser = userRes.data.data.user;
          console.log('TikTok username:', tiktokUser.username);
          console.log('TikTok follower_count:', tiktokUser.follower_count);
        } else {
          console.warn('No se encontró el objeto user en la respuesta extendida de TikTok.');
        }
      } catch (e) {
        console.warn('No se pudo obtener info extendida del usuario TikTok, usando solo open_id');
      }

      // 3. Tu lógica de usuario existente...

      let user = await this.usersService.findByUsername(tiktokUser.open_id);
      if (!user) {
        let assignedTeam: any = undefined;
        for (let division = 1; division <= 5; division++) {
          const botTeams = await this.usersService.findBotTeamsByDivision(division);
          if (Array.isArray(botTeams) && botTeams.length > 0 && botTeams[0]?.id) {
            assignedTeam = botTeams[0];
            break;
          }
        }

        user = await this.usersService.createFromTikTok({
          username: tiktokUser.open_id,
          teamId: assignedTeam?.id
        });

        if (assignedTeam?.id) {
          const newName = tiktokUser.username || tiktokUser.open_id || `Equipo de ${tiktokUser.open_id}`;
          await this.usersService.updateTeamBotAssignment({
            teamId: assignedTeam.id,
            isBot: false,
            name: newName
          });
        }
      }

      return this.login(user, { follower_count: tiktokUser.follower_count });

    } catch (err) {
      console.error('=== TikTok OAuth Error Details ===');
      if (err.response) {
        console.error('Status:', err.response.status);
        console.error('Headers:', err.response.headers);
        console.error('Data:', JSON.stringify(err.response.data, null, 2));
      } else if (err.request) {
        console.error('Request made but no response:', err.request);
      } else {
        console.error('Error message:', err.message);
      }
      console.error('Full error:', err);

      throw new UnauthorizedException('Error en login con TikTok: ' + (err.response?.data?.data?.description || err.message));
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
