import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'supersecreto', // Cambia esto por una variable de entorno en producción
    });
  }

  async validate(payload: any) {
    // El payload estará disponible en req.user
    return { userId: payload.sub, username: payload.username, role: payload.role };
  }
}
