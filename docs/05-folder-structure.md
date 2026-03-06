# 폴더 구조 (v2.2.1)

## 1. 현재 구조
```text
autoLV/
  apps/
    api/
      alembic.ini
      alembic/
        env.py
        versions/
          20260302_0001_init_v1_schema.py
          20260302_0002_add_query_logs.py
          20260304_0003_add_parcels_and_postgis.py
          20260305_0004_add_email_verifications_and_terms.py
          20260305_0005_add_phone_number_to_users.py
          20260306_0006_add_zone_analysis_tables.py
          20260306_0007_alter_parcels_geom_to_multipolygon.py
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
          user.py
          email_verification.py
          bulk_job.py
          query_log.py
          parcel.py
          zone_analysis.py
          zone_analysis_parcel.py
        repositories/
          user_repository.py
          bulk_job_repository.py
          query_log_repository.py
          email_verification_repository.py
        schemas/
          auth.py
          bulk.py
          history.py
          land.py
          map.py
        services/
          auth_service.py
          email_service.py
          land_code_service.py
          road_name_service.py
          terms_service.py
          vworld_service.py
          map_service.py
          map_zone_service.py
          bulk/
            constants.py
            column_mapper.py
            normalizer.py
            processor.py
            result_writer.py
            table_reader.py
            template_service.py
            job_service.py
            job_storage.py
        main.py
      scripts/
        run_migrations.py
        reset_db_and_seed_admin.py
      storage/                       # 런타임 생성
      .env.example
      requirements.txt
      README.md
    web/
      app/
        api/
          vworld-proxy/
            route.ts
        components/
          auth-modal.tsx
          auth-provider.tsx
          profile-action-modal.tsx
          files/
            bulk-upload-panel.tsx
            bulk-job-table.tsx
        lib/
          address.ts
          bulk-api.ts
          history-api.ts
          map-api.ts
          types.ts
        (main)/
          layout.tsx
          search/page.tsx
          map/page.tsx
          files/page.tsx
          history/page.tsx
          features/page.tsx
          mypage/page.tsx
          privacy/page.tsx
          account-deletion/page.tsx
        globals.css
        layout.tsx
        page.tsx
      public/
        ld_codes.json
        downloads/
          autoLV-android-release-v2.1.2.apk
      .env.example
      package.json
      tsconfig.json
    mobile/
      android/
      assets/
      capacitor.config.ts
      package.json
      README.md
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
    feature-spec.md
    architecture.svg
    TN_SPRD_RDNM.txt
    autoLV icon.jpg
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
  backend/                           # legacy
  frontend/                          # legacy
  crawler/                           # legacy
  README.md
```

## 2. 구조 설명
- `apps/api`: FastAPI 서버/비즈니스 로직/DB 마이그레이션
- `apps/web`: Next.js 웹 서비스(개별조회/지도조회/파일조회/조회기록/마이페이지)
- `apps/mobile`: Capacitor 기반 Android 래퍼 앱
- `infra/vworld-proxy`: VWorld 고정 IP 프록시 서비스
- `docs`: 요구사항/아키텍처/API/배포/릴리스 노트

## 3. 운영 시 주의 경로
- 도로명 원본 데이터: `docs/TN_SPRD_RDNM.txt`
- 법정동 코드 파일: `apps/web/public/ld_codes.json`
- 파일 업로드 결과(런타임): `apps/api/storage/bulk`
- 프로필 이미지(런타임): `apps/api/storage/profile_images`
- 배포 APK 파일(최신): `apps/web/public/downloads/autoLV-android-release-v2.2.0.apk`
- 고정 다운로드 경로: `apps/web/public/downloads/autoLV-android-release.apk`

## 4. 모듈 분리 원칙
- API는 `api -> schemas -> services -> repositories -> models` 계층으로 분리
- Bulk 처리 로직은 `services/bulk/*`로 세분화해 유지보수성 확보
- Web은 페이지/컴포넌트/API 클라이언트(`lib/*`)를 분리
- 지도조회/조회기록은 페이지 단의 UI와 API 호출 모듈을 분리
- 저장 구역/조회기록 삭제처럼 목록성 기능은 페이지 UI와 API 클라이언트 분리 원칙 유지

## 5. 향후 확장 권장
- 지도 폴리곤 분석 고도화 시 모듈 분리 권장:
  - `app/services/map_zone_service.py` 내 계산/집계/내보내기 하위 모듈화
- 운영 지표 도입 시 모듈 추가 권장:
  - `app/services/metrics_service.py`
  - `app/api/metrics.py`
- 건축물대장 분석 확장 시 모듈 추가 권장:
  - `app/services/building_register_service.py`
  - `app/services/zone_building_service.py`
  - `app/models/building_register_cache.py`
