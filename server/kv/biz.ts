import {useKv} from "~/server/utils/kv";

export interface BizEntry {
    alias: string
    fakeid: string
    nickname: string
    round_head_img: string
    service_type: number
    signature: string
}


export async function getBizEntry(fakeid: string): Promise<BizEntry | null> {
    // 由于本地kv依赖存在问题，所以本地启动的服务跳过相关代码
    // https://github.com/denoland/denokv/issues/45
    // https://github.com/wechat-article/wechat-article-exporter/issues/12
    if (process.dev) {
        return null
    }

    const kv = await useKv()
    const {value: bizEntry} = await kv.get(["biz", fakeid])
    kv.close()
    return bizEntry
}
