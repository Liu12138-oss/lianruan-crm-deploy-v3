-- S10-019 回退：仅移除本迁移新增的用户侧唯一索引，不删除企微身份数据。
DROP INDEX IF EXISTS iam.ux_external_identities_wecom_user_active;
