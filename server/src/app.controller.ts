import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getInfo(): { name: string; version: string; status: string } {
    return this.appService.getInfo();
  }

  @Get('health')
  getHealth(): { status: string; date: string } {
    return {
      status: 'ok',
      date: new Date().toISOString(),
    };
  }

  @Get('status')
  getStatus(): { status: string; date: string } {
    return {
      status: 'ok',
      date: new Date().toISOString(),
    };
  }
}
