const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

// 读取docx文件 (实际上是zip文件)
const docxPath = 'C:/Users/老刘/Desktop/渠道商等级功能需求V1.0.docx';

try {
    // 读取文件
    const buffer = fs.readFileSync(docxPath);
    
    // 解压缩 (docx是zip格式)
    // 简单的zip解析 - 查找document.xml
    let offset = 0;
    let documentContent = null;
    
    // 查找本地文件头签名 (PK\x03\x04)
    while (offset < buffer.length - 30) {
        if (buffer[offset] === 0x50 && buffer[offset + 1] === 0x4B && 
            buffer[offset + 2] === 0x03 && buffer[offset + 3] === 0x04) {
            
            // 解析本地文件头
            const compressionMethod = buffer.readUInt16LE(offset + 8);
            const compressedSize = buffer.readUInt32LE(offset + 18);
            const fileNameLength = buffer.readUInt16LE(offset + 26);
            const extraFieldLength = buffer.readUInt16LE(offset + 28);
            
            const fileName = buffer.toString('utf8', offset + 30, offset + 30 + fileNameLength);
            
            if (fileName === 'word/document.xml') {
                const fileData = buffer.slice(
                    offset + 30 + fileNameLength + extraFieldLength,
                    offset + 30 + fileNameLength + extraFieldLength + compressedSize
                );
                
                // 解压缩
                documentContent = zlib.inflateRawSync(fileData).toString('utf8');
                break;
            }
            
            offset += 30 + fileNameLength + extraFieldLength + compressedSize;
        } else {
            offset++;
        }
    }
    
    if (documentContent) {
        // 提取文本内容
        const textMatches = documentContent.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
        if (textMatches) {
            const texts = textMatches.map(match => {
                const textMatch = match.match(/<w:t[^>]*>([^<]+)<\/w:t>/);
                return textMatch ? textMatch[1] : '';
            });
            console.log(texts.join('\n'));
        }
    }
} catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
}
