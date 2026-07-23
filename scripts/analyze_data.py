import json, sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'd:\远程交付中心文件\建设材料\AI项目及frp\联软渠道管理平台\项目文件夹\lianruan-crm-deploy-v2.2.0\backend\data.json'
with open(path, 'r', encoding='utf-8') as f:
    db = json.load(f)

print('=== users 角色分布 ===')
roles = {}
for u in db['users']:
    r = u.get('role', '?')
    roles[r] = roles.get(r, 0) + 1
for k, v in roles.items():
    print('  ' + k + ': ' + str(v) + ' 人')

print()
print('=== partners 等级分布 ===')
levels = {}
for p in db['partners']:
    pl = p.get('partnerLevel', 'none')
    levels[pl] = levels.get(pl, 0) + 1
for k, v in levels.items():
    print('  ' + k + ': ' + str(v) + ' 家')

print()
print('=== users 列表（role + name + partnerId） ===')
for u in db['users']:
    role = u['role']
    name = u.get('name', '')[:15]
    pid = u.get('partnerId', '-')
    print('  ' + str(role).ljust(12) + ' | ' + str(name).ljust(15) + ' | partnerId=' + str(pid))

print()
print('=== partners 列表（id + name + partnerLevel） ===')
for p in db['partners']:
    print('  ' + p['id'] + ' | ' + p.get('name','')[:20] + ' | level=' + str(p.get('partnerLevel','none')))