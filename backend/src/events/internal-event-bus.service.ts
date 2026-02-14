import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events'

export type InternalEvent = { type: string; payload?: any }

@Injectable()
export class InternalEventBusService {
  private readonly logger = new Logger(InternalEventBusService.name)
  private ee = new EventEmitter()

  publish(type: string, payload?: any) {
    try {
      this.logger.log(`InternalEvent publish: ${type}`)
      // persistent trace for internal events to aid debugging (temporary)
      try { fs.appendFileSync(path.join(process.cwd(), 'logs', 'wire_debug.log'), JSON.stringify({ ts: Date.now(), event: 'INTERNAL_PUBLISH', type, payload: payload ? (typeof payload === 'object' ? JSON.stringify(payload).substring(0,1000) : String(payload)) : null }) + '\n'); } catch (e) { /* swallow */ }
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
