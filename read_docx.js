const fs = require('fs');
const AdmZip = require('adm-zip');
const xml2js = require('xml2js');

try {
    const docxPath = 'C:/Users/老刘/Desktop/渠道商等级功能需求V1.0.docx';
    const zip = new AdmZip(docxPath);
    const xmlContent = zip.readAsText('word/document.xml');
    
    // Simple regex-based extraction
    const matches = xmlContent.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    if (matches) {
        const texts = matches.map(m => {
            const match = m.match(/<w:t[^>]*>([^<]+)<\/w:t>/);
            return match ? match[1] : '';
        });
        console.log(texts.join('\n'));
    }
} catch (error) {
    console.error('Error:', error.message);
}
