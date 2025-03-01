import {H3Event, parseCookies} from "h3";

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
    event: H3Event
    endpoint: string
    method: Method
    query?: Record<string, string | number | undefined>
    body?: Record<string, string | number | undefined>
    parseJson?: boolean
    withCredentials?: boolean
    headers?: Record<string, string>
    timeout?: number
    retries?: number
}

/**
 * 睡眠函数
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带超时的 fetch
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeout = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

export async function proxyMpRequest(options: RequestOptions) {
    console.log('proxyMpRequest - Starting request to:', options.endpoint);
    
    const cookies = parseCookies(options.event)
    const cookie = Object.keys(cookies).map(key => `${key}=${cookies[key]}`).join(';')

    if (options.withCredentials === undefined) {
        options.withCredentials = true;
    }

    console.log('proxyMpRequest - Cookie length:', cookie.length);
    
    const headers: Record<string, string> = {
        Referer: 'https://mp.weixin.qq.com/',
        Origin: 'https://mp.weixin.qq.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    };
    
    // 只有在需要时添加 Cookie 头
    if (options.withCredentials && cookie.length > 0) {
        headers.Cookie = cookie;
    }
    
    // 添加自定义头
    if (options.headers) {
        Object.assign(headers, options.headers);
    }
    
    const fetchInit: RequestInit = {
        method: options.method,
        headers,
        // 添加缓存控制
        cache: 'no-cache',
        credentials: 'omit'
    }

    let finalUrl = options.endpoint;
    if (options.query) {
        const queryString = new URLSearchParams(options.query as Record<string, string>).toString();
        finalUrl += '?' + queryString;
        console.log('proxyMpRequest - Final URL with query:', finalUrl);
    }
    
    if (options.method === 'POST' && options.body) {
        fetchInit.body = new URLSearchParams(options.body as Record<string, string>).toString()
        console.log('proxyMpRequest - Request has body, length:', fetchInit.body.length);
    }

    console.log('proxyMpRequest - Sending request with headers:', headers);
    
    const maxRetries = options.retries || 3;
    const timeout = options.timeout || 10000;
    
    let lastError: Error | null = null;
    
    // 添加重试逻辑
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`proxyMpRequest - Attempt ${attempt}/${maxRetries}...`);
            
            // 使用带超时的 fetch
            const response = await fetchWithTimeout(finalUrl, fetchInit, timeout);
            
            console.log('proxyMpRequest - Response received:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries([...response.headers.entries()]),
            });
            
            // 如果是 503 或其他临时错误，可能需要重试
            if (response.status >= 500 && response.status < 600 && attempt < maxRetries) {
                console.log(`proxyMpRequest - Received status ${response.status}, will retry...`);
                await sleep(1000 * attempt); // 指数退避
                continue;
            }
            
            if (!options.parseJson) {
                // 对于二进制数据，确保响应是有效的
                console.log('proxyMpRequest - Returning raw response for binary data');
                return response;
            } else {
                // 解析 JSON 响应
                console.log('proxyMpRequest - Parsing JSON response');
                return await response.json();
            }
        } catch (error: any) {
            lastError = error;
            console.error(`proxyMpRequest - Fetch error on attempt ${attempt}:`, error);
            
            if (attempt < maxRetries) {
                const delay = 1000 * attempt;
                console.log(`proxyMpRequest - Retrying in ${delay}ms...`);
                await sleep(delay);
            }
        }
    }
    
    // 所有重试都失败了
    console.error('proxyMpRequest - All retry attempts failed');
    throw lastError || new Error('All retry attempts failed');
}

export function formatTraffic(bytes: number) {
    if (bytes < 1024) {
        return `${bytes} Bytes`
    } else if (bytes < 1024 ** 2) {
        return `${(bytes / 1024).toFixed(2)} KB`
    } else if (bytes < 1024 ** 3) {
        return `${(bytes / (1024 ** 2)).toFixed(2)} MB`
    } else if (bytes < 1024 ** 4) {
        return `${(bytes / (1024 ** 3)).toFixed(2)} GB`
    } else if (bytes < 1024 ** 5) {
        return `${(bytes / (1024 ** 4)).toFixed(2)} TB`
    }
}
