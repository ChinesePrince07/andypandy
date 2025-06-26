import type { ReactionDto } from '../../src/app/api/reactions/dto'
import type { ViewDto } from '../../src/app/api/views/dto'

export class Client {
  constructor(private readonly baseUrl: string) {}

  async actView(data: ViewDto) {
    return await fetch(`${this.baseUrl}/api/views`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async actReaction(data: ReactionDto) {
    return await fetch(`${this.baseUrl}/api/reactions`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
}
