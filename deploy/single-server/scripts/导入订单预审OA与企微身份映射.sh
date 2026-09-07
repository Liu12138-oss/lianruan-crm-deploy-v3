#!/usr/bin/env bash
set -euo pipefail

# 仅导入明确来源、当前启用且属于订单预审范围的身份映射。
# 默认只生成预检报告；写入必须同时传入 --apply、--confirm 和 --actor。
# 本次按负责人确认，显式排除待清理的历史/占位账号，不修改这些账号本身。

install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
run_mode="preview"
input_file=""
actor_username=""
confirmation=""

show_usage() {
  cat <<'EOF'
用法：
  bash 导入订单预审OA与企微身份映射.sh --input <企微映射表.xlsx> [--install-root <目录>]
  bash 导入订单预审OA与企微身份映射.sh --input <企微映射表.xlsx> --apply --actor <超级管理员登录名> --confirm 导入已核验身份映射 [--install-root <目录>]

说明：
  1. 默认预检，不写入数据库。
  2. 仅处理当前启用的超级管理员、管理员、区域管理员，以及订单预审固定群成员。
  3. 企业微信 UserId 来自 Excel 的“姓名、账号”列；泛微 OA userid 仅从生产已有的
     iam.eteams_account_reference_mappings 获取，绝不把企业微信账号写入泛微字段。
  4. 存在姓名缺失、重复、既有映射冲突或泛微参考缺失时，--apply 会拒绝执行，避免部分导入。
EOF
}

fail() {
  echo "身份映射导入失败：$*" >&2
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --input)
      input_file="${2:-}"
      shift 2
      ;;
    --install-root)
      install_root="${2:-}"
      shift 2
      ;;
    --apply)
      run_mode="apply"
      shift
      ;;
    --actor)
      actor_username="${2:-}"
      shift 2
      ;;
    --confirm)
      confirmation="${2:-}"
      shift 2
      ;;
    -h|--help)
      show_usage
      exit 0
      ;;
    *)
      fail "不支持的参数：$1"
      ;;
  esac
done

[ -n "${input_file}" ] || fail "必须提供 --input <企微映射表.xlsx>。"
[ -f "${input_file}" ] || fail "未找到映射表文件：${input_file}"
[ -d "${install_root}/compose" ] || fail "未找到生产 Compose 目录：${install_root}/compose"
command -v python3 >/dev/null 2>&1 || fail "需要 python3 读取 xlsx 文件，但当前服务器未安装 python3。"
command -v docker >/dev/null 2>&1 || fail "未找到 docker 命令。"

if [ "${run_mode}" = "apply" ]; then
  [ -n "${actor_username}" ] || fail "写入时必须通过 --actor 指定当前启用的超级管理员账号。"
  [ "${confirmation}" = "导入已核验身份映射" ] || fail "写入时必须传入 --confirm 导入已核验身份映射。"
fi

temp_dir="$(mktemp -d)"
sql_file="${temp_dir}/身份映射导入.sql"
cleanup() {
  rm -rf "${temp_dir}"
}
trap cleanup EXIT

python3 - "${input_file}" "${sql_file}" "${run_mode}" "${actor_username}" <<'PY'
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from sys import argv, stderr
from xml.etree import ElementTree as ET
from zipfile import BadZipFile, ZipFile

input_path = Path(argv[1])
output_path = Path(argv[2])
mode = argv[3]
actor_username = argv[4]
ns = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def column_name(reference: str) -> str:
    return "".join(char for char in reference if char.isalpha())


def sql_text(value: str) -> str:
    if "\x00" in value:
        raise ValueError("映射表包含不允许的空字符")
    return "'" + value.replace("'", "''") + "'"


def read_rows(path: Path) -> list[tuple[int, str, str]]:
    try:
        with ZipFile(path) as archive:
            shared_strings: list[str] = []
            if "xl/sharedStrings.xml" in archive.namelist():
                root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
                shared_strings = [
                    "".join(node.text or "" for node in item.iter("{%s}t" % ns["m"]))
                    for item in root.findall("m:si", ns)
                ]
            workbook = ET.fromstring(archive.read("xl/workbook.xml"))
            relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
            relationship_targets = {
                item.attrib["Id"]: item.attrib["Target"] for item in relationships
            }
            sheet = workbook.find("m:sheets/m:sheet", ns)
            if sheet is None:
                raise ValueError("映射表没有工作表")
            target = relationship_targets[sheet.attrib["{%s}id" % ns["r"]]]
            if not target.startswith("xl/"):
                target = "xl/" + target.lstrip("/")
            sheet_root = ET.fromstring(archive.read(target))
    except (BadZipFile, KeyError, ET.ParseError) as exc:
        raise ValueError(f"无法读取 xlsx 文件：{exc}") from exc

    rows: list[tuple[int, str, str]] = []
    for row in sheet_root.findall(".//m:sheetData/m:row", ns):
        values: dict[str, str] = {}
        for cell in row.findall("m:c", ns):
            raw_value = cell.find("m:v", ns)
            value = "" if raw_value is None else (raw_value.text or "")
            if cell.attrib.get("t") == "s" and value:
                value = shared_strings[int(value)]
            elif cell.attrib.get("t") == "inlineStr":
                value = "".join(
                    node.text or "" for node in cell.iter("{%s}t" % ns["m"])
                )
            values[column_name(cell.attrib.get("r", ""))] = value.strip()
        row_number = int(row.attrib.get("r", "0"))
        name = values.get("A", "")
        account = values.get("B", "")
        if row_number == 1:
            if name != "姓名" or account != "账号":
                raise ValueError("映射表首行必须是“姓名、账号”两列")
            continue
        if not name and not account:
            continue
        if not name or not account:
            raise ValueError(f"第 {row_number} 行的姓名或账号为空")
        rows.append((row_number, name, account))
    if not rows:
        raise ValueError("映射表没有有效数据")
    return rows


try:
    rows = read_rows(input_path)
    names: set[str] = set()
    accounts: set[str] = set()
    for row_number, name, account in rows:
        account_key = account.casefold()
        if name in names:
            raise ValueError(f"姓名重复：{name}（第 {row_number} 行）")
        if account_key in accounts:
            raise ValueError(f"账号重复：{account}（第 {row_number} 行）")
        names.add(name)
        accounts.add(account_key)
except ValueError as exc:
    print(f"映射表校验失败：{exc}", file=stderr)
    raise SystemExit(1)

now = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
lines = [
    "\\set ON_ERROR_STOP on",
    "BEGIN;",
    "CREATE TEMP TABLE input_wecom_mappings (source_row integer PRIMARY KEY, display_name text NOT NULL UNIQUE, wecom_userid text NOT NULL UNIQUE) ON COMMIT DROP;",
]
for start in range(0, len(rows), 200):
    values = ",\n  ".join(
        f"({row_number}, {sql_text(name)}, {sql_text(account)})"
        for row_number, name, account in rows[start : start + 200]
    )
    lines.append(
        "INSERT INTO input_wecom_mappings(source_row, display_name, wecom_userid) VALUES\n  "
        + values
        + ";"
    )

lines.extend(
    [
        "CREATE TEMP TABLE identity_import_plan ON COMMIT DROP AS",
        "WITH role_scope AS (",
        "  SELECT u.id AS user_id,",
        "         bool_or(r.role_code IN ('superadmin','admin','region_manager') AND r.status_code='active') AS is_administrator,",
        "         bool_or(r.role_code IN ('admin','region_manager') AND r.status_code='active') AND u.region_id IS NOT NULL AS is_oa_initiator,",
        "         string_agg(DISTINCT r.role_code, ',' ORDER BY r.role_code) FILTER (WHERE r.status_code='active') AS role_codes",
        "  FROM iam.users u",
        "  LEFT JOIN iam.user_roles ur ON ur.user_id=u.id",
        "  LEFT JOIN iam.roles r ON r.id=ur.role_id",
        "  WHERE u.status_code='active'",
        "  GROUP BY u.id, u.region_id",
        "), scoped_users AS (",
        "  SELECT u.id AS user_id, u.username::text AS username, u.display_name, rs.role_codes,",
        "         (rs.is_administrator OR lower(u.username::text) IN ('liangwanqi','liangguangyao','shoulong','liulonghai'))",
        "           AND lower(u.username::text) NOT IN (",
        "             'admin_sh','admin_db','admin_bj','admin_ah','admin_sd','admin_gz','admin_jj','admin_js',",
        "             'admin_henan','admin_test','admin_zgj','admin_sz','admin_hn','admin_west','admin_zhy',",
        "             'region_admin_save_1788232088689_login','wangbo','admin','yucaihong','liuchengzhou'",
        "           ) AS is_in_scope,",
        "         rs.is_oa_initiator AS is_oa_initiator,",
        "         (rs.is_oa_initiator OR lower(u.username::text)='zhanhuaiyu') AS is_eteams_target,",
        "         lower(u.username::text) IN ('liangwanqi','liangguangyao','shoulong','liulonghai') AS is_fixed_group_member",
        "  FROM iam.users u",
        "  JOIN role_scope rs ON rs.user_id=u.id",
        "  WHERE u.status_code='active'",
        "), source_match AS (",
        "  SELECT s.*, input.source_row, input.wecom_userid",
        "  FROM scoped_users s",
        "  LEFT JOIN input_wecom_mappings input ON input.display_name=s.display_name",
        "  WHERE s.is_in_scope",
        ")",
        "SELECT s.*,",
        "       ref.external_subject AS eteam_userid,",
        "       ref.external_username AS eteam_username,",
        "       COALESCE(existing_wecom.identity_count, 0) AS existing_wecom_count,",
        "       existing_wecom.external_subject AS existing_wecom_userid,",
        "       COALESCE(existing_eteams.identity_count, 0) AS existing_eteams_count,",
        "       existing_eteams.external_subject AS existing_eteams_userid,",
        "       EXISTS (SELECT 1 FROM source_match other WHERE other.display_name=s.display_name AND other.user_id<>s.user_id) AS duplicate_display_name,",
        "       EXISTS (SELECT 1 FROM iam.external_identities x WHERE x.provider_code='wecom' AND x.status_code='active' AND x.external_subject=s.wecom_userid AND x.user_id<>s.user_id) AS wecom_userid_occupied,",
        "       EXISTS (SELECT 1 FROM iam.external_identities x WHERE x.provider_code='eteams' AND x.status_code='active' AND x.external_subject=ref.external_subject AND x.user_id<>s.user_id) AS eteams_userid_occupied",
        "FROM source_match s",
        "LEFT JOIN LATERAL (",
        "  SELECT count(*)::integer AS identity_count, min(external_subject) AS external_subject",
        "  FROM iam.external_identities x WHERE x.user_id=s.user_id AND x.provider_code='wecom' AND x.status_code='active'",
        ") existing_wecom ON true",
        "LEFT JOIN LATERAL (",
        "  SELECT count(*)::integer AS identity_count, min(external_subject) AS external_subject",
        "  FROM iam.external_identities x WHERE x.user_id=s.user_id AND x.provider_code='eteams' AND x.status_code='active'",
        ") existing_eteams ON true",
        "LEFT JOIN LATERAL (",
        "  SELECT r.external_subject, r.external_username",
        "  FROM iam.eteams_account_reference_mappings r",
        "  WHERE lower(r.v3_username::text)=lower(s.wecom_userid)",
        "    AND r.expected_display_name=s.display_name",
        "    AND r.mapping_status='auto_match_enabled'",
        "  ORDER BY r.source_file_row",
        "  LIMIT 1",
        ") ref ON s.wecom_userid IS NOT NULL;",
        "ALTER TABLE identity_import_plan ADD COLUMN wecom_result text;",
        "ALTER TABLE identity_import_plan ADD COLUMN eteams_result text;",
        "UPDATE identity_import_plan SET wecom_result = CASE",
        "  WHEN duplicate_display_name THEN '同姓名对应多个V3账号，需人工确认'",
        "  WHEN wecom_userid IS NULL AND existing_wecom_count=1 THEN '保留既有企微映射（来源表未找到姓名）'",
        "  WHEN wecom_userid IS NULL THEN '缺少企微来源映射'",
        "  WHEN existing_wecom_count>1 THEN '当前账号存在多个有效企微映射'",
        "  WHEN existing_wecom_count=1 AND existing_wecom_userid=wecom_userid THEN '企微映射已生效'",
        "  WHEN existing_wecom_count=1 THEN '既有企微映射与来源表冲突'",
        "  WHEN wecom_userid_occupied THEN '企微 UserId 已绑定其他账号'",
        "  ELSE '待新增企微映射' END;",
        "UPDATE identity_import_plan SET eteams_result = CASE",
        "  WHEN NOT is_eteams_target THEN '不适用（非 OA 发起人或指定泛微账号）'",
        "  WHEN duplicate_display_name THEN '同姓名对应多个V3账号，需人工确认'",
        "  WHEN eteam_userid IS NULL AND existing_eteams_count=1 THEN '保留既有泛微映射（无自动参考）'",
        "  WHEN eteam_userid IS NULL THEN '缺少泛微参考映射'",
        "  WHEN existing_eteams_count>1 THEN '当前账号存在多个有效泛微映射'",
        "  WHEN existing_eteams_count=1 AND existing_eteams_userid=eteam_userid THEN '泛微映射已生效'",
        "  WHEN existing_eteams_count=1 THEN '既有泛微映射与参考表冲突'",
        "  WHEN eteams_userid_occupied THEN '泛微 userid 已绑定其他账号'",
        "  ELSE '待新增泛微映射' END;",
        "SELECT CASE WHEN is_fixed_group_member THEN '固定群成员' WHEN is_oa_initiator THEN 'OA 发起人' ELSE '内部管理员' END AS 范围,",
        "       username AS V3登录名, display_name AS 姓名, COALESCE(role_codes,'') AS 有效角色,",
        "       COALESCE(wecom_userid,'') AS 来源企微UserId, wecom_result AS 企微处理结果,",
        "       COALESCE(eteam_userid,'') AS 泛微userid, eteams_result AS 泛微处理结果",
        "FROM identity_import_plan ORDER BY 范围, 姓名, V3登录名;",
        "SELECT count(*) FILTER (WHERE wecom_result LIKE '待新增%') AS 待新增企微映射数,",
        "       count(*) FILTER (WHERE eteams_result LIKE '待新增%') AS 待新增泛微映射数,",
        "       count(*) FILTER (WHERE wecom_result LIKE '缺少%' OR wecom_result LIKE '%冲突%' OR wecom_result LIKE '%多个%' OR wecom_result LIKE '%同姓名%') AS 企微阻断数,",
        "       count(*) FILTER (WHERE is_eteams_target AND (eteams_result LIKE '缺少%' OR eteams_result LIKE '%冲突%' OR eteams_result LIKE '%多个%' OR eteams_result LIKE '%同姓名%')) AS 泛微阻断数",
        "FROM identity_import_plan;",
    ]
)

if mode == "apply":
    lines.extend(
        [
            "CREATE TEMP TABLE import_actor ON COMMIT DROP AS",
            "SELECT u.id AS user_id, u.username::text AS username, u.display_name, string_agg(DISTINCT r.role_name, ',' ORDER BY r.role_name) AS role_names",
            "FROM iam.users u JOIN iam.user_roles ur ON ur.user_id=u.id JOIN iam.roles r ON r.id=ur.role_id",
            f"WHERE u.status_code='active' AND r.status_code='active' AND lower(u.username::text)=lower({sql_text(actor_username)}) AND r.role_code='superadmin'",
            "GROUP BY u.id, u.username, u.display_name;",
            "DO $$ BEGIN IF (SELECT count(*) FROM import_actor)<>1 THEN RAISE EXCEPTION '操作人必须是唯一启用的超级管理员账号。'; END IF; END $$;",
            "DO $$ BEGIN",
            "  IF EXISTS (SELECT 1 FROM identity_import_plan WHERE wecom_result LIKE '缺少%' OR wecom_result LIKE '%冲突%' OR wecom_result LIKE '%多个%' OR wecom_result LIKE '%同姓名%')",
            "     OR EXISTS (SELECT 1 FROM identity_import_plan WHERE is_eteams_target AND (eteams_result LIKE '缺少%' OR eteams_result LIKE '%冲突%' OR eteams_result LIKE '%多个%' OR eteams_result LIKE '%同姓名%')) THEN",
            "    RAISE EXCEPTION '预检存在阻断项，拒绝部分导入；请先补齐或处理冲突。';",
            "  END IF;",
            "END $$;",
            "CREATE TEMP TABLE inserted_identities (id uuid, user_id uuid, provider_code text, external_subject text, display_name text) ON COMMIT DROP;",
            "WITH inserted AS (",
            "  INSERT INTO iam.external_identities(user_id,provider_code,external_subject,external_username,status_code)",
            "  SELECT user_id,'wecom',wecom_userid,display_name,'active' FROM identity_import_plan WHERE wecom_result='待新增企微映射'",
            "  RETURNING id,user_id,provider_code,external_subject",
            ") INSERT INTO inserted_identities(id,user_id,provider_code,external_subject,display_name)",
            "SELECT inserted.id,inserted.user_id,inserted.provider_code,inserted.external_subject,plan.display_name FROM inserted JOIN identity_import_plan plan ON plan.user_id=inserted.user_id;",
            "WITH inserted AS (",
            "  INSERT INTO iam.external_identities(user_id,provider_code,external_subject,external_username,status_code)",
            "  SELECT user_id,'eteams',eteam_userid,eteam_username,'active' FROM identity_import_plan WHERE eteams_result='待新增泛微映射'",
            "  RETURNING id,user_id,provider_code,external_subject",
            ") INSERT INTO inserted_identities(id,user_id,provider_code,external_subject,display_name)",
            "SELECT inserted.id,inserted.user_id,inserted.provider_code,inserted.external_subject,plan.display_name FROM inserted JOIN identity_import_plan plan ON plan.user_id=inserted.user_id;",
            "INSERT INTO audit.audit_logs(created_at,request_id,actor_user_id,actor_username,actor_name,actor_role,module_code,action_code,target_type,target_id,target_name,result_code,message,before_json,after_json,extra_json)",
            f"SELECT now(), 'identity-import-{now}', actor.user_id, actor.username, actor.display_name, actor.role_names, 'integration', 'external_identity.batch_import', item.provider_code, item.id::text, item.display_name, 'success', '订单预审 OA 与企微身份映射批量导入', '{{}}'::jsonb, jsonb_build_object('providerCode',item.provider_code,'externalSubject',item.external_subject), jsonb_build_object('source','联软账号去敏版本（企微对应账号）.xlsx') FROM inserted_identities item CROSS JOIN import_actor actor;",
            "SELECT provider_code AS 身份提供方, count(*) AS 本次新增数 FROM inserted_identities GROUP BY provider_code ORDER BY provider_code;",
            "COMMIT;",
            "SELECT '身份映射导入完成。请在启用订单预审任务前完成区域真实选项映射、泛微参数和企微自建应用受控试发。' AS 结果;",
        ]
    )
else:
    lines.extend(["ROLLBACK;", "SELECT '预检完成：未写入数据库。' AS 结果;"])

output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"已解析映射表：{len(rows)} 条。", file=stderr)
PY

echo "映射表已解析。执行模式：${run_mode}"
echo "生产安装目录：${install_root}"
echo "本次显式排除 20 个不参与导入的账号；不会修改这些账号。"
echo "说明：预检结果中的“缺少”或“冲突”会阻止写入；脚本不会部分导入。"

cd "${install_root}/compose"
docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U lianruan_app -d lianruan_crm_v3 -f - < "${sql_file}"
