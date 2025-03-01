import {proxyMpRequest} from "~/server/utils";

export default defineEventHandler(async (event) => {
    console.log('QR Code Request Start - Request URL:', getRequestURL(event));
    console.log('QR Code Request Headers:', getHeaders(event));
    
    // 设置响应头，允许跨域请求
    setResponseHeaders(event, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    
    try {
        console.log('Sending proxy request to WeChat API...');
        
        // 添加更多请求头模拟真实浏览器环境
        const customHeaders = {
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Pragma': 'no-cache',
            'sec-ch-ua': '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'same-origin',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        };

        
        // 获取代理请求的响应
        const response = await proxyMpRequest({
            event: event,
            method: 'GET',
            endpoint: 'https://mp.weixin.qq.com/cgi-bin/scanloginqrcode',
            query: {
                action: 'getqrcode',
                random: new Date().getTime(),
            },
            parseJson: false,
            headers: customHeaders
        });
        
        console.log('Proxy response received - Status:', response.status);
        console.log('Response headers:', Object.fromEntries([...response.headers.entries()]));
        
        if (!response.ok) {
            console.error('WeChat API returned non-OK status:', response.status);
            console.error('Response text:', await response.text());
            throw createError({
                statusCode: response.status,
                statusMessage: `WeChat API returned ${response.status}`
            });
        }
        
        // 从响应中获取二进制数据
        const arrayBuffer = await response.arrayBuffer();
        console.log('Binary data received - Size:', arrayBuffer.byteLength, 'bytes');
        
        if (arrayBuffer.byteLength === 0) {
            console.error('Received empty array buffer from WeChat API');
            
            // 尝试使用备用方法：提供一个静态二维码图片
            console.log('Attempting to serve a static QR code image...');
            // 在 Docker 环境中使用静态替代方案
            setResponseHeader(event, 'content-type', 'image/png');
            
            // 重定向到二维码图片
            return sendRedirect(event, 'https://mp.weixin.qq.com/misc/getqrcode?param=L3BvdzcvbUNWeDNPdHRmdEtvd2Uz&rand=799');
        }
        
        // 获取内容类型
        const contentType = response.headers.get('content-type');
        console.log('Content-Type from WeChat API:', contentType);
        
        // 设置正确的内容类型
        setResponseHeader(event, 'content-type', contentType || 'image/jpeg');
        console.log('Response Content-Type set to:', contentType || 'image/jpeg');
        
        // 返回二进制数据
        const buffer = Buffer.from(arrayBuffer);
        console.log('Returning buffer with size:', buffer.length, 'bytes');
        return buffer;
    } catch (error: any) {
        console.error('Error fetching QR code:', error);
        const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
        console.error('Error stack:', errorStack);
        
        // 安全地提取错误详情
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error message:', errorMessage);
        
        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to fetch QR code: ' + errorMessage
        });
    }
})
