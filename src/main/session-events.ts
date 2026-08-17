/**
 * 会话事件监听：通过 WebSocket 消费 dsh web 的宿主事件流
 * （ws://127.0.0.1:<port>/api/events.host，JSON 文本帧，schema 同官方连接层），
 * 在任务完成（host/session-status running=false）时回调。
 */
export class SessionEventWatcher {
  private ws: WebSocket | null = null
  private running = new Map<string, boolean>()
  private notified = new Set<string>()
  private stopped = false

  start(baseUrl: string, onComplete: (sessionId: string) => void): void {
    this.stopped = false
    void this.connect(baseUrl, onComplete, 0)
  }

  stop(): void {
    this.stopped = true
    this.ws?.close()
    this.ws = null
  }

  private connect(baseUrl: string, onComplete: (sessionId: string) => void, attempt: number): void {
    if (this.stopped) return
    const wsUrl = baseUrl.replace(/^http/, 'ws') + '/api/events.host'
    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrl)
    } catch {
      this.retry(baseUrl, onComplete, attempt)
      return
    }
    this.ws = ws

    ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(String(event.data)) as {
          type?: string
          sessionId?: string
          running?: boolean
          blank?: boolean
        }
        if (!frame.sessionId) return
        if (frame.type === 'host/session-added') {
          this.running.set(frame.sessionId, true)
        } else if (frame.type === 'host/session-status') {
          const wasRunning = this.running.get(frame.sessionId)
          this.running.set(frame.sessionId, frame.running === true)
          if (wasRunning === true && frame.running === false && !this.notified.has(frame.sessionId)) {
            this.notified.add(frame.sessionId)
            onComplete(frame.sessionId)
          }
        }
      } catch {
        /* 忽略非法帧 */
      }
    }

    ws.onclose = () => {
      if (this.stopped) return
      this.ws = null
      this.retry(baseUrl, onComplete, attempt)
    }
    ws.onerror = () => {
      /* 交给 onclose 处理 */
    }
  }

  private retry(baseUrl: string, onComplete: (sessionId: string) => void, attempt: number): void {
    if (this.stopped) return
    const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5))
    setTimeout(() => this.connect(baseUrl, onComplete, attempt + 1), delay)
  }
}
