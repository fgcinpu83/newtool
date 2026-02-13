import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter } from 'events'

export type InternalEvent = { type: string; payload?: any }

@Injectable()
export class InternalEventBusService {
  private readonly logger = new Logger(InternalEventBusService.name)
  private ee = new EventEmitter()

  publish(type: string, payload?: any) {
    try {
      this.logger.log(`InternalEvent publish: ${type}`)
      this.ee.emit(type, payload)
    } catch (e) {
      this.logger.error('InternalEvent publish failed', e as any)
    }
  }

  on(type: string, handler: (payload?: any) => void) {
    this.ee.on(type, handler)
    this.logger.log(`InternalEvent handler registered: ${type}`)
  }

  off(type: string, handler: (payload?: any) => void) {
    this.ee.off(type, handler)
    this.logger.log(`InternalEvent handler removed: ${type}`)
  }
}
