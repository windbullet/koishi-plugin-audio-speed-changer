import { Context, Schema, h } from 'koishi'
import { } from 'koishi-plugin-ffmpeg'
import { } from 'koishi-plugin-silk'

export const name = 'audio-speed-changer'
export const inject = ['ffmpeg', 'silk']

export const usage = '支持调用指令后发语音和回复语音两种方法'

export interface Config { }

export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  ctx.command('语音变速 <speed:number>', '对语音进行变速')
    .usage('支持调用指令后发语音和回复语音两种方法')
    .action(async ({ session }, speed) => {
      if (!speed) return '未设置倍速，输入“help 语音变速”查看指令用法'
      if (speed <= 0) return '倍速必须大于0'

      let elements: h[] = []
      if (session.quote) {
        elements = session.quote.elements
      } else {
        await session.send('在60秒内发送想要变速的语音')
        let msg = await session.prompt(60000)
        if (msg !== undefined) {
          elements = h.parse(msg)
        }
      }

      const audio = h.select(elements, 'audio')
      if (audio.length === 0) return '这看上去不是音频。'

      const res = await ctx.http(audio[0].attrs.src, { responseType: 'arraybuffer' })
      if (!ctx.silk.isSilk) throw new Error('请更新 silk 插件至最新版本')

      let changedAudio: Buffer
      const outputOption = ['-f', 'wav', '-af', `atempo=${speed}`]
      if (ctx.silk.isSilk(res.data)) {
        const pcm = await ctx.silk.decode(res.data, 24000)
        changedAudio = await ctx.ffmpeg
          .builder()
          .input(Buffer.from(pcm.data))
          .inputOption('-f', 's16le', '-ar', '24000', '-ac', '1')
          .outputOption(...outputOption)
          .run('buffer')
      } else {
        changedAudio = await ctx.ffmpeg
          .builder()
          .input(Buffer.from(res.data))
          .outputOption(...outputOption)
          .run('buffer')
      }
      if (changedAudio.length === 0) return '音频变速失败。'

      return h.audio(changedAudio, 'audio/vnd.wave')
    })
}
