import { Injectable, Logger } from '@nestjs/common'

export type CommandPayload = { type: string; payload?: any; originAccount?: string }

@Injectable()
export class CommandRouterService {
  private readonly logger = new Logger(CommandRouterService.name)
  private owners: Map<string, (cmd: CommandPayload) => Promise<any> | any> = new Map()

  register(command: string, handler: (cmd: CommandPayload) => Promise<any> | any) {
    if (this.owners.has(command)) {
      this.logger.warn(`Owner already registered for command: ${command} - overriding`)
    }
    this.owners.set(command, handler)
    this.logger.log(`Registered owner for command: ${command}`)
  }

  async route(cmd: CommandPayload) {
    if (!cmd || !cmd.type) return
    // Prevent router re-entry: if route is already processing, block re-entry
    if ((this as any).__routing) {
      this.logger.error(`Router re-entry detected for command: ${cmd.type} - blocking to prevent recursive routing`)
      return { success: false, message: 'Router re-entry blocked', type: cmd.type }
    }
    const handler = this.owners.get(cmd.type)
    if (!handler) {
      this.logger.warn(`No owner for command: ${cmd.type} - rejecting`)
      return { success: false, message: 'Unknown command', type: cmd.type }
    }
    try {
      this.logger.log(`Routing command: ${cmd.type}`);
      (this as any).__routing = true;
      const res = await handler(cmd);
      (this as any).__routing = false;
      return { success: true, result: res }
    } catch (e: any) {
      this.logger.error(`Handler for ${cmd.type} failed: ${e?.message || e}`);
      (this as any).__routing = false;
      return { success: false, message: e?.message || String(e) };
    }
  }

  getRegisteredCommands(): string[] {
    return Array.from(this.owners.keys())
  }
}
