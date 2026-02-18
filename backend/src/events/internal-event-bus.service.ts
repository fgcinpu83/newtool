import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

@Injectable()
export class InternalEventBusService extends EventEmitter {
    // tiny compatibility shim for previous internal event bus
    publish(eventName: string, payload?: any) {
        this.emit(eventName, payload);
    }
}
