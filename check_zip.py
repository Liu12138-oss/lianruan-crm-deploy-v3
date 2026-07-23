import zipfile, json, sys
sys.stdout.reconfigure(encoding='utf-8')
zp = r'd:\远程交付中心文件\建设材料\AI项目及frp\联软渠道管理平台\项目文件夹\lianruan-crm-deploy-v2.2.0_clean.zip'
with zipfile.ZipFile(zp, 'r') as z:
    for name in z.namelist():
        if 'data.json' in name:
            info = z.getinfo(name)
            print(f'{name}: {info.file_size} bytes')
            if 'backup' not in name:
                data = json.loads(z.read(name))
                print('  quotes: ' + str(len(data.get('quotes',[]))))
                print('  opportunities: ' + str(len(data.get('opportunities',[]))))
                cats = [c['id'] for c in data.get('categories',[])]
                print('  categories: ' + str(cats))
