#!/usr/bin/env bash
set -euo pipefail

# 统一消息平台只读运行观测。输出仅含聚合数量、状态和时长，不查询正文、接收人或渠道凭据。
install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
compact=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --compact) compact=true ;;
    *)
      echo "未知参数：$1。仅支持 --compact。" >&2
      exit 1
      ;;
  esac
  shift
done

compose_dir="${install_root}/compose"
if [ ! -d "${compose_dir}" ]; then
  echo "未找到 Compose 目录：${compose_dir}" >&2
  exit 1
fi

cd "${compose_dir}"

查询() {
  docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U lianruan_app -d lianruan_crm_v3 -P pager=off -c "$1"
}

message_schema_exists="$(docker compose exec -T postgres psql -X -tAc "SELECT to_regnamespace('message') IS NOT NULL" -U lianruan_app -d lianruan_crm_v3 2>/dev/null || true)"
if [ "${message_schema_exists}" != "t" ]; then
  echo "消息观测跳过：message 架构尚未迁移。"
  exit 0
fi

echo "统一消息平台只读运行观测"
echo "采集时间：$(date '+%Y-%m-%d %H:%M:%S %z')"
echo
echo "消息角色容器状态："
for service in worker-message-critical worker-message-maintenance worker-message-integration; do
  container_id="$(docker compose ps -q "${service}" 2>/dev/null || true)"
  if [ -z "${container_id}" ]; then
    echo "${service}=未运行"
    continue
  fi
  state="$(docker inspect -f '{{.State.Status}}' "${container_id}" 2>/dev/null || echo "未知")"
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}未配置{{end}}' "${container_id}" 2>/dev/null || echo "未知")"
  echo "${service}=状态:${state}，健康:${health}"
done

echo
echo "消费积压与最老待处理时长："
查询 "
  SELECT '事件消费' AS 指标,
         status_code AS 状态,
         count(*) AS 数量,
         COALESCE(floor(EXTRACT(EPOCH FROM now() - min(created_at)))::bigint, 0) AS 最老秒数
  FROM message.event_consumptions
  WHERE status_code IN ('pending', 'retry_wait', 'processing')
  GROUP BY status_code
  UNION ALL
  SELECT '投递记录' AS 指标,
         status_code AS 状态,
         count(*) AS 数量,
         COALESCE(floor(EXTRACT(EPOCH FROM now() - min(created_at)))::bigint, 0) AS 最老秒数
  FROM message.deliveries
  WHERE status_code IN ('pending', 'retry_wait', 'sending')
  GROUP BY status_code
  ORDER BY 1, 2;
"

if [ "${compact}" = false ]; then
  echo
  echo "近 24 小时外部投递成功率（仅以成功和最终失败计算）："
  查询 "
    SELECT channel_code AS 渠道,
           count(*) FILTER (WHERE status_code = 'success') AS 成功数,
           count(*) FILTER (WHERE status_code = 'failed') AS 最终失败数,
           count(*) FILTER (WHERE status_code IN ('pending', 'sending', 'retry_wait')) AS 处理中数,
           CASE WHEN count(*) FILTER (WHERE status_code IN ('success', 'failed')) = 0 THEN NULL
                ELSE round(100.0 * count(*) FILTER (WHERE status_code = 'success') /
                     count(*) FILTER (WHERE status_code IN ('success', 'failed')), 2)
            END AS 成功率百分比
    FROM message.deliveries
    WHERE channel_code <> 'in_app' AND created_at >= now() - interval '24 hours'
    GROUP BY channel_code
    ORDER BY channel_code;
  "

  delivery_attempts_table_exists="$(docker compose exec -T postgres psql -X -tAc "SELECT to_regclass('message.delivery_attempts') IS NOT NULL" -U lianruan_app -d lianruan_crm_v3 2>/dev/null || true)"
  echo
  if [ "${delivery_attempts_table_exists}" = "t" ]; then
    echo "近 24 小时外部失败类型（不输出响应摘要）："
    查询 "
      SELECT channel_code AS 渠道,
             provider_code AS 供应商代码,
             COALESCE(http_status::text, '无HTTP状态') AS HTTP状态,
             status_code AS 结果状态,
             count(*) AS 数量
      FROM message.delivery_attempts
      WHERE created_at >= now() - interval '24 hours' AND status_code IN ('retry_wait', 'failed', 'ignored')
      GROUP BY channel_code, provider_code, http_status, status_code
      ORDER BY 数量 DESC, 渠道, 供应商代码
      LIMIT 50;
    "
  else
    echo "外部失败类型：M2 投递尝试事实表尚未迁移，暂只保留投递状态统计。"
  fi
fi

echo
echo "连续失败任务状态："
查询 "
  SELECT worker_code AS 工作器,
         consecutive_failure_count AS 连续失败次数,
         threshold_event_emitted AS 已生成阈值事件,
         CASE WHEN last_failure_at IS NULL THEN NULL
              ELSE floor(EXTRACT(EPOCH FROM now() - last_failure_at))::bigint END AS 距最后失败秒数
  FROM message.worker_failure_streaks
  ORDER BY worker_code;
"
