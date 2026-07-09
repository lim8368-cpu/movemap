# Production Security Schema Draft

운영 DB는 로컬 `server/data/db.json`이 아니라 별도 클라우드 DB를 사용합니다.
아래는 환자 개인정보를 저장해야 할 때의 기본 설계입니다.

## organizations

- `id` UUID primary key
- `name`
- `created_at`

## users

- `id` UUID primary key
- `organization_id` UUID
- `role` enum: `admin`, `therapist`, `front_desk`, `read_only`
- `email`
- `password_hash` nullable when using external auth
- `mfa_enabled`
- `disabled_at`
- `created_at`

## patients

- `id` UUID primary key
- `organization_id` UUID
- `encrypted_name`
- `encrypted_phone`
- `encrypted_birth_date`
- `encrypted_diagnosis`
- `retention_until`
- `deleted_at`
- `created_at`
- `updated_at`

주민등록번호는 컬럼을 만들지 않습니다.

## patient_assignments

- `id` UUID primary key
- `organization_id` UUID
- `patient_id` UUID
- `therapist_user_id` UUID
- `can_read` boolean
- `can_write` boolean
- `created_at`

## treatment_notes

- `id` UUID primary key
- `organization_id` UUID
- `patient_id` UUID
- `author_user_id` UUID
- `encrypted_note`
- `created_at`
- `updated_at`
- `deleted_at`

## patient_files

- `id` UUID primary key
- `organization_id` UUID
- `patient_id` UUID
- `private_storage_key`
- `original_extension`
- `mime_type`
- `size_bytes`
- `created_at`
- `deleted_at`

파일 URL을 DB에 저장하지 않고 private storage key만 저장합니다.

## audit_logs

- `id` UUID primary key
- `organization_id` UUID
- `actor_user_id` UUID
- `action`
- `object_type`
- `object_id`
- `status`
- `created_at`

감사 로그에는 환자 이름, 연락처, 진단명, 치료내용, 비밀번호, 토큰을 저장하지 않습니다.
