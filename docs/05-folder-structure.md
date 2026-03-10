# 폴더 구조 (2026-03-10 기준)

> 현재 운영 기준 코드는 `apps/web`, `apps/api`, `apps/mobile`이며, 브랜치 상태는 `v3.0 준비 중`이다.

## 1. 현재 기준 소스 트리
```text
Pilji-Lab/
  apps/
    api/
      alembic/
        versions/
          20260302_0001_init_v1_schema.py
          20260302_0002_add_query_logs.py
          20260304_0003_add_parcels_table.py
          20260305_0004_add_email_verification_and_terms.py
          20260305_0005_add_user_phone_number.py
          20260306_0006_add_zone_analysis_tables.py
          20260306_0007_alter_parcels_geom_to_multipolygon.py
          20260307_0008_add_land_metadata_to_zone_parcels.py
          20260309_0009_add_building_register_cache.py
          20260310_0010_add_building_register_extra_metrics.py
          20260310_0011_add_zone_accuracy_fields.py
          20260310_0012_add_zone_ai_fields.py
      app/
        api/
          auth.py
          bulk.py
          health.py
          history.py
          land.py
          map.py
        core/
          config.py
          security.py
        db/
          base.py
          session.py
        models/
          building_register_cache.py
          bulk_job.py
          email_verification.py
          parcel.py
          query_log.py
          user.py
          zone_ai_feedback.py
          zone_analysis.py
          zone_analysis_parcel.py
        repositories/
          bulk_job_repository.py
          email_verification_repository.py
          query_log_repository.py
          user_repository.py
        schemas/
          auth.py
          bulk.py
          history.py
          land.py
          map.py
        services/
          auth_service.py
          building_register_service.py
          email_service.py
          ld_code_service.py
          map_service.py
          map_zone_service.py
          road_name_service.py
          terms_service.py
          vworld_service.py
          bulk/
            column_mapper.py
            constants.py
            job_service.py
            job_storage.py
            normalizer.py
            processor.py
            queue.py
            result_writer.py
            table_reader.py
            template_service.py
          map_zone/
            ai.py
            buildings.py
            domain.py
            geometry.py
            parcels.py
            summary.py
        main.py
      scripts/
        reset_db_and_seed_admin.py
        run_bulk_worker.py
        run_migrations.py
      storage/                        # 런타임 생성
      .env.example
      README.md
      alembic.ini
      ld_codes.json
      requirements.txt
      TN_SPRD_RDNM.txt
    web/
      app/
        (main)/
          account-deletion/page.tsx
          features/page.tsx
          files/page.tsx
          history/page.tsx
          layout.tsx
          map/page.tsx
          mypage/page.tsx
          privacy/page.tsx
          search/page.tsx
        api/
          vworld-proxy/
            route.ts
        components/
          auth-modal.tsx
          auth-provider.tsx
          brand-logo.tsx
          profile-action-modal.tsx
          files/
            bulk-job-table.tsx
            bulk-upload-panel.tsx
          map/
            map-floating-workbench.tsx
            map-result-drawer.tsx
            map-rows-table.tsx
            map-workspace-toolbar.tsx
            metric-card.tsx
            zone-comparison-card.tsx
            zone-library-panel.tsx
            zone-result-table.tsx
            zone-review-queue.tsx
          ui/
            loading-indicator.tsx
        lib/
          address.ts
          api-client.ts
          bulk-api.ts
          history-api.ts
          map-api.ts
          map-view-utils.ts
          types.ts
          zone-comparison.ts
        brand-refresh.css
        globals.css
        layout.tsx
        page.tsx
      public/
        brand/
          piljilab-logo.png
        downloads/
          autoLV-android-release.apk
          autoLV-android-release-v2.1.2.apk
          autoLV-android-release-v2.2.0.apk
        ld_codes.json
      .env.example
      README.md
      next.config.mjs
      package.json
      package-lock.json
      postcss.config.mjs
      tailwind.config.ts
      tsconfig.json
    mobile/
      android/
      assets/
      www/
      .env.signing.example
      capacitor.config.json
      package.json
      package-lock.json
      README.md
    worker/
      jobs/                           # 현재 미사용 placeholder
      tasks/                          # 현재 미사용 placeholder
  docs/
    01-requirements.md
    02-system-architecture.md
    03-api-spec.md
    04-db-schema.md
    05-folder-structure.md
    06-deployment.md
    07-release-notes-v1.0.0.md
    08-portfolio-enhancement.md
    09-release-notes-v2.2.0.md
    10-release-notes-v2.2.1.md
    11-ai-zone-accuracy-plan.md
    feature-spec.md
    architecture.svg
    autoLV icon.jpg
    서비스 로고.png
    TN_SPRD_RDNM.txt
    assets/
    samples/
  infra/
    docker/
      Dockerfile.api
      docker-compose.v1.yml
    scripts/                         # 현재 비어 있음
    sql/                             # 현재 비어 있음
    vworld-proxy/
      app/
      deploy/
        autolv-vworld-proxy.service
      .env.example
      README.md
      requirements.txt
  backend/                           # legacy
  crawler/                           # legacy
  frontend/                          # legacy
  packages/                          # 현재 비어 있음
  README.md
```

## 2. 현재 구조 해석
- `apps/api`가 현재 운영 API의 중심이다.
- `apps/web`이 현재 운영 웹과 문서용 다운로드 자산을 함께 가진다.
- `apps/mobile`은 `https://auto-lv.vercel.app`를 감싸는 Capacitor Android wrapper다.
- `apps/worker`는 현재 실제 배포 경로가 아니라, 향후 별도 worker 앱 분리를 위한 placeholder 성격이다.
- `infra/vworld-proxy`는 Railway에서 VWorld 직접 호출이 불안정할 때 쓰는 고정 IP 프록시다.
- `backend`, `frontend`, `crawler`는 현행 운영 경로가 아니라 보관 중인 레거시 영역이다.

## 3. 운영 시 중요한 경로
- 도로명 원본 데이터: `docs/TN_SPRD_RDNM.txt`
- API 대체 참조 경로: `apps/api/TN_SPRD_RDNM.txt`
- 법정동 코드: `apps/web/public/ld_codes.json`
- API 대체 참조 경로: `apps/api/ld_codes.json`
- Bulk 업로드/결과 파일: `apps/api/storage/bulk`
- 프로필 이미지 저장: `apps/api/storage/profile_images`
- 웹 다운로드용 APK alias: `apps/web/public/downloads/autoLV-android-release.apk`
- 버전 고정 APK 보관본: `apps/web/public/downloads/autoLV-android-release-v2.2.0.apk`

## 4. 현재 관찰되는 생성물과 로컬 산출물
- 아래 항목은 소스 구조의 일부라기보다 로컬 실행/빌드 결과물이다.
- `apps/api/.env`
- `apps/api/autolv.db`
- `apps/api/migrate_test.db`
- `apps/api/uvicorn-*.log`
- `apps/api/storage/*`
- `apps/web/node_modules`
- `apps/mobile/node_modules`
- `apps/mobile/android/build/*`

비고:
- 문서 트리에는 이런 생성물을 핵심 구조로 취급하지 않는다.
- 다만 현재 저장소 안에는 실제로 존재할 수 있으므로, 새 작업 시 소스와 생성물을 구분해서 다뤄야 한다.

## 5. 모듈 분리 기준
- API는 `api -> schemas -> services -> repositories -> models` 흐름을 유지한다.
- Bulk 처리 로직은 `services/bulk/*`로 분리돼 API 요청 처리와 작업 실행 책임을 나눈다.
- 구역 분석은 `services/map_zone/*`로 세분화돼 geometry, parcel composition, building summary, AI enrichment 책임을 나눈다.
- Web은 `page.tsx`가 상태 오케스트레이션을 담당하고, 실제 UI는 `components/*`로 분리한다.
- `/map`은 단일 페이지이지만 현재도 `toolbar`, `workbench`, `drawer`, `review queue`, `comparison`, `library` 단위까지는 분해돼 있다.

## 6. 현재 큰 파일과 정리 우선순위
- `apps/web/app/(main)/map/page.tsx`
- `apps/api/app/services/map_zone_service.py`
- `apps/api/app/services/map_service.py`
- `apps/web/app/(main)/search/page.tsx`

정리 원칙:
- 동작을 먼저 보존하고 책임만 줄인다.
- UI 상태 관리와 도메인 계산을 한 파일에 계속 섞지 않는다.
- 모바일 대응 로직은 페이지 후반 보정이 아니라 컴포넌트 경계에서 같이 관리한다.

## 7. 향후 확장 여지
- `apps/worker`: Bulk/AI 추론 전용 프로세스를 별도 앱으로 분리할 때 사용할 수 있다.
- `packages`: 공용 타입/유틸/디자인 토큰을 분리할 필요가 생기면 사용 가능하다.
- `infra/scripts`, `infra/sql`: 운영 스크립트와 SQL 점검 스니펫을 별도 관리할 때 사용할 수 있다.
