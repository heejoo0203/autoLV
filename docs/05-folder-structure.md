# 폴더 구조 (v3.0 준비)

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
          user.py
          email_verification.py
          bulk_job.py
          query_log.py
          parcel.py
          zone_analysis.py
          zone_analysis_parcel.py
          zone_ai_feedback.py
          building_register_cache.py
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
          building_register_service.py
          map_zone_service.py
          map_zone/
            ai.py
            buildings.py
            domain.py
            geometry.py
            parcels.py
            summary.py
          bulk/
            constants.py
            column_mapper.py
            queue.py
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
        run_bulk_worker.py
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
          map/
            map-rows-table.tsx
            metric-card.tsx
            zone-library-panel.tsx
            zone-result-table.tsx
          files/
            bulk-upload-panel.tsx
            bulk-job-table.tsx
        lib/
          address.ts
          api-client.ts
          bulk-api.ts
          history-api.ts
          map-api.ts
          map-view-utils.ts
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
    11-ai-zone-accuracy-plan.md
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
- `apps/api/scripts/run_bulk_worker.py`: Redis 기반 파일조회 전용 워커
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
- bulk 실행 경로는 `job_service.py -> queue.py -> run_bulk_worker.py -> processor.py`로 분리해 API 프로세스와 작업 프로세스를 분리
- Web은 페이지/컴포넌트/API 클라이언트(`lib/*`)를 분리
- 지도조회/조회기록은 페이지 단의 UI와 API 호출 모듈을 분리
- 저장 구역/조회기록 삭제처럼 목록성 기능은 페이지 UI와 API 클라이언트 분리 원칙 유지
- 구역 사업성 분석은 `map_zone/*`와 `building_register_service.py`로 분리해 공간 계산과 건축물대장 연동 책임을 분리
- 건축물대장 원본 응답은 `building_register_caches`에 캐시하고, 구역 응답은 실시간 집계만 수행
- v3 정확도 고도화 기준으로 `map_zone/*`는 geometry / parcels / buildings / summary 도메인 단위로 유지
- AI 1차 계층은 `map_zone/ai.py`에 격리해 추천/이상치/신뢰도 계산을 공간 계산 로직과 분리
- AI 피드백은 `zone_ai_feedback.py` 모델과 `/map/zones/{zone_id}/parcels/decision` 경로로 분리
- 향후 raw / normalized / serving 계층 도입 시 서비스/모델도 같은 단위로 분리
- legacy 디렉터리(`backend`, `frontend`, `crawler`)는 각 폴더의 `README.md`로 현재 비운영 상태를 명시

## 5. 향후 확장 권장
- 지도 폴리곤 분석 고도화 시 AI/보정 계층 추가 권장:
  - `app/services/map_zone_snap_service.py`
  - `app/services/map_zone_ml_service.py`
  - `app/services/map_zone_feedback_service.py`
- 운영 지표 도입 시 모듈 추가 권장:
  - `app/services/metrics_service.py`
  - `app/api/metrics.py`
- 건축물대장 분석 확장 시 추가 권장:
  - `app/services/building_register_frontage_service.py`
  - `app/services/building_register_illegal_service.py`
  - `app/models/building_frontage_cache.py`
  - `app/models/illegal_building_registry.py`
- AI 추천/설명 계층 확장 시 모듈 추가 권장:
  - `app/services/llm_report_service.py`
  - `app/models/zone_ai_suggestion.py`
  - `app/models/zone_ai_model_registry.py`
- raw / normalized / serving 계층 확장 시 모듈 추가 권장:
  - `app/models/vworld_raw_payload.py`
  - `app/models/building_register_raw_payload.py`
  - `app/models/parcel_serving_snapshot.py`
