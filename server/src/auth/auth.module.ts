import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from  './users.service';
import { AuthController } from  './auth.controller';

@Module({
  imports: [PassportModule, JwtModule.register({
    secret: 'supersecreto', // Cambia esto por una variable de entorno en producción
    signOptions: { expiresIn: '1d' },
  })],
  providers: [AuthService, JwtStrategy, UsersService],
  controllers: [AuthController],
  exports: [AuthService, UsersService],
})
export class AuthModule {}
