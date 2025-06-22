import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Guard para proteger endpoints con JWT
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
