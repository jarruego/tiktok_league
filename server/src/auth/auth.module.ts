import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from  './users.service';
import { AuthController } from  './auth.controller';
import { GoogleAuthService } from './google.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'fallback-secret-key',
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    })
  ],
  providers: [AuthService, UsersService, GoogleAuthService],
  controllers: [AuthController],
  exports: [AuthService, UsersService],
})
export class AuthModule {}
