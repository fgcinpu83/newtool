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
    const handler = this.owners.get(cmd.type)
    if (!handler) {
      this.logger.warn(`No owner for command: ${cmd.type} - rejecting`)
      return { success: false, message: 'Unknown command', type: cmd.type }
    }
    try {
      this.logger.log(`Routing command: ${cmd.type}`)
      const res = await handler(cmd)
      return { success: true, result: res }
    } catch (e: any) {
      this.logger.error(`Handler for ${cmd.type} failed: ${e?.message || e}`)
      return { success: false, message: e?.message || String(e) }
    }
  }

  getRegisteredCommands(): string[] {
    return Array.from(this.owners.keys())
  }
}
