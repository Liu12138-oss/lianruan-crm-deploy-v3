import zipfile, json
zp = r'd:\远程交付中心文件\建设材料\AI项目及frp\联软渠道管理平台\项目文件夹\lianruan-crm-deploy-v2.2.0_clean.zip'
with zipfile.ZipFile(zp, 'r') as z:
    bak = z.getinfo('backend/data.json.backup_biz_20260419_195722.json')
    print('备份文件大小: ' + str(bak.file_size) + ' bytes')
    bak_data = json.loads(z.read('backend/data.json.backup_biz_20260419_195722.json'))
    print('备份 quotes: ' + str(len(bak_data.get('quotes',[]))))
    print('备份 opportunities: ' + str(len(bak_data.get('opportunities',[]))))
    print('备份 categories: ' + str([c['id'] for c in bak_data.get('categories',[])]))
