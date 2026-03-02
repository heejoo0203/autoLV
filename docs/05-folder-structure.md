# 폴더 구조

## 1. 현재 구조 (v1.0.0 기준)
```text
autoLV/
  apps/
    api/
      alembic.ini
      alembic/
        env.py
        script.py.mako
        versions/
          20260302_0001_init_v1_schema.py
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
        run_migrations.py
        reset_db_and_seed_admin.py
      storage/               # 런타임 생성(업로드/결과/프로필 이미지)
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
          profile-action-modal.tsx
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
    07-release-notes-v1.0.0.md
    feature-spec.md
    architecture.svg
    TN_SPRD_RDNM.txt
    samples/
  infra/
    docker/
      Dockerfile.api
      docker-compose.v1.yml
    vworld-proxy/
      app/
      deploy/
        autolv-vworld-proxy.service
      .env.example
      README.md
      requirements.txt
  backend/   # 레거시 코드
  crawler/   # 레거시 코드
  frontend/  # 레거시 코드
  packages/
  README.md
```

## 2. 참고 사항
- `docs/TN_SPRD_RDNM.txt`는 도로명 자음/목록 필터링 원천 파일이다.
- `apps/api/storage`는 런타임 산출물 경로이며 `.gitignore`로 제외된다.
- `apps/api/alembic`은 운영 DB(PostgreSQL) 스키마 마이그레이션 경로다.
- 파일조회 결과 샘플(`docs/samples/*_result.xlsx`)은 `.gitignore`로 제외된다.
- 조회기록은 현재 `apps/web`의 `localStorage` 기반이다.
- `infra/vworld-proxy`는 VWorld 우회용 고정 IP 프록시 배포 모듈이다.

## 3. 다음 단계 구조 확장
- `apps/api`에 지도조회/공간집계 모듈 추가
- PostgreSQL/PostGIS 전환 시 공간 테이블 마이그레이션 버전 추가
- Redis 캐시 계층 도입 시 cache 모듈 분리
