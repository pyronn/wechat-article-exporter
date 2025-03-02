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
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
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
    
    try {
        const response = await fetch(finalUrl, fetchInit);
        console.log('proxyMpRequest - Response received:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries([...response.headers.entries()]),
        });
        
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
        console.error('proxyMpRequest - Fetch error:', error);
        console.error('proxyMpRequest - Error message:', error instanceof Error ? error.message : String(error));
        throw error; // 重新抛出错误以便上层处理
    }
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
