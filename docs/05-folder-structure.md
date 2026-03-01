# 폴더 구조

## 1. 현재 구조 (v1 기준)
```text
autoLV/
  apps/
    api/
      app/
        api/
          auth.py
          bulk.py
          health.py
          land.py
        core/
          config.py
          security.py
        db/
          base.py
          session.py
        models/
          bulk_job.py
          user.py
        repositories/
          bulk_job_repository.py
          user_repository.py
        schemas/
          auth.py
          bulk.py
          land.py
        services/
          auth_service.py
          ld_code_service.py
          road_name_service.py
          vworld_service.py
          bulk/
            column_mapper.py
            constants.py
            job_service.py
            job_storage.py
            normalizer.py
            processor.py
            result_writer.py
            table_reader.py
            template_service.py
        main.py
      scripts/
        reset_db_and_seed_admin.py
      storage/               # 런타임 생성(업로드/결과 파일)
      .env.example
      requirements.txt
      README.md
    web/
      app/
        (main)/
          layout.tsx
          search/page.tsx
          files/page.tsx
          history/page.tsx
        components/
          auth-modal.tsx
          auth-provider.tsx
          files/
            bulk-job-table.tsx
            bulk-upload-panel.tsx
        lib/
          address.ts
          bulk-api.ts
          history-storage.ts
          types.ts
        globals.css
        layout.tsx
        page.tsx
      public/
        ld_codes.json
      .env.example
      package.json
  docs/
    01-requirements.md
    02-system-architecture.md
    03-api-spec.md
    04-db-schema.md
    05-folder-structure.md
    06-deployment.md
    feature-spec.md
    architecture.svg
    TN_SPRD_RDNM.txt
    samples/
  backend/   # 레거시 코드
  crawler/   # 레거시 코드
  frontend/  # 레거시 코드
  infra/
  packages/
  README.md
```

## 2. 참고 사항
- `docs/TN_SPRD_RDNM.txt`는 도로명 자음/목록 필터링 원천 파일이다.
- `apps/api/storage`는 런타임 산출물 경로이며 `.gitignore`로 제외된다.
- 파일조회 결과 샘플(`docs/samples/*_result.xlsx`)도 `.gitignore`로 제외된다.
- 조회기록은 현재 `apps/web`의 `localStorage` 기반이다.

## 3. 다음 단계 구조 확장
- `apps/api`에 지도조회/공간집계 모듈 추가
- PostgreSQL/PostGIS 전환 시 마이그레이션 디렉터리 추가
- Redis 캐시 계층 도입 시 cache 모듈 분리
