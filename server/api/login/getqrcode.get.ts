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
        // 获取代理请求的响应
        const response = await proxyMpRequest({
            event: event,
            method: 'GET',
            endpoint: 'https://mp.weixin.qq.com/cgi-bin/scanloginqrcode',
            query: {
                action: 'getqrcode',
                random: new Date().getTime(),
            },
            parseJson: false, // Explicitly set parseJson to false for binary data
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
            throw createError({
                statusCode: 500,
                statusMessage: 'Empty QR code data received'
            });
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
