import { Test, TestingModule } from '@nestjs/testing';
import { CallGateway } from './call.gateway';
import { CallService } from './call.service';

describe('CallGateway', () => {
  let gateway: CallGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CallGateway, CallService],
    }).compile();

    gateway = module.get<CallGateway>(CallGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
