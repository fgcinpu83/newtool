export class RawDataEvent { constructor(public data:any){ this.provider = (data && data.provider) || null; this.type = (data && data.type) || null; } public provider?: string; public type?: string }
export class CmdWorker {
	public onData: (e: any) => void = () => {};
	public client: any = { post: async () => ({ status: 404 }) };
	start() { /* stub */ }
	stop() { /* stub */ }
	setSession(s:any) { /* stub */ }
}
export class ApiWorker { start() { /* stub */ } }
