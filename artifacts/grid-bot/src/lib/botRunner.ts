export class BotRunner {
  private running = false;
  
  constructor(
    public botId: number,
    private endpoint: string,
    private wsEndpoint: string,
    private privateKey: string,
    private accountPubkey: string
  ) {}

  async start() {
    this.running = true;
    console.log(`Starting bot ${this.botId}`);
    // Basic stub logic here
  }

  stop() {
    this.running = false;
    console.log(`Stopping bot ${this.botId}`);
  }
}
