import zipfile
import xml.etree.ElementTree as ET

docx_path = 'C:/Users/老刘/Desktop/渠道商等级功能需求V1.0.docx'

with zipfile.ZipFile(docx_path) as z:
    xml_content = z.read('word/document.xml')
    root = ET.fromstring(xml_content)
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    
    # 提取所有文本节点
    texts = []
    for elem in root.findall('.//w:t', ns):
        if elem.text:
            texts.append(elem.text)
    
    print('\n'.join(texts))
