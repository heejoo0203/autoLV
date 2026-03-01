"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useAuth } from "@/app/components/auth-provider";
import { ROAD_INITIALS, roadsByInitial } from "@/app/lib/address";
import { addSearchHistory, loadSearchHistory } from "@/app/lib/history-storage";
import type { LdMap, LandResultRow, SearchTab } from "@/app/lib/types";

const SAN_OPTIONS = ["일반", "산"] as const;

export default function SearchPage() {
  const { user } = useAuth();
  const params = useSearchParams();

  const [ldMap, setLdMap] = useState<LdMap>({});
  const [searchTab, setSearchTab] = useState<SearchTab>("지번");

  const [sido, setSido] = useState("");
  const [sigungu, setSigungu] = useState("");
  const [dong, setDong] = useState("");

  const [roadInitial, setRoadInitial] = useState<"" | (typeof ROAD_INITIALS)[number]>("");
  const [roadName, setRoadName] = useState("");

  const [sanType, setSanType] = useState<(typeof SAN_OPTIONS)[number]>("일반");
  const [mainNo, setMainNo] = useState("");
  const [subNo, setSubNo] = useState("");
  const [buildingMainNo, setBuildingMainNo] = useState("");
  const [buildingSubNo, setBuildingSubNo] = useState("");

  const [message, setMessage] = useState("주소를 선택한 뒤 검색 버튼을 눌러주세요.");
  const [rows, setRows] = useState<LandResultRow[]>([]);

  const isLoggedIn = Boolean(user);

  const sidoList = useMemo(() => Object.keys(ldMap), [ldMap]);
  const sigunguList = useMemo(() => (sido ? Object.keys(ldMap[sido] ?? {}) : []), [ldMap, sido]);
  const dongList = useMemo(() => (sido && sigungu ? Object.keys(ldMap[sido]?.[sigungu] ?? {}) : []), [ldMap, sido, sigungu]);
  const roadList = useMemo(() => (sigungu ? roadsByInitial(sigungu, roadInitial) : []), [sigungu, roadInitial]);

  useEffect(() => {
    void loadCodes();
  }, []);

  useEffect(() => {
    const recordId = params.get("recordId");
    if (!recordId) return;
    const ownerKey = user?.user_id ?? user?.email ?? "";
    const rec = loadSearchHistory().find((x) => x.id === recordId && x.ownerKey === ownerKey);
    if (!rec) return;
    setRows(rec.결과);
    setMessage(`이력에서 선택한 주소 결과입니다: ${rec.주소요약}`);
  }, [params, user]);

  const loadCodes = async () => {
    try {
      const res = await fetch("/ld_codes.json", { cache: "force-cache" });
      if (!res.ok) throw new Error("주소 코드 로드 실패");
      setLdMap((await res.json()) as LdMap);
    } catch {
      setMessage("주소 코드 파일을 불러오지 못했습니다.");
    }
  };

  const onSelectSido = (value: string) => {
    setSido(value);
    setSigungu("");
    setDong("");
    setRoadInitial("");
    setRoadName("");
  };

  const onSelectSigungu = (value: string) => {
    setSigungu(value);
    setDong("");
    setRoadInitial("");
    setRoadName("");
  };

  const runSearch = () => {
    if (!sido || !sigungu) {
      setMessage("시/도와 시/군/구를 선택해 주세요.");
      return;
    }

    if (searchTab === "지번") {
      if (!dong || !mainNo) {
        setMessage("지번 검색에는 읍/면/동과 본번이 필요합니다.");
        return;
      }
      const jibun = `${sanType === "산" ? "산 " : ""}${mainNo}${subNo ? `-${subNo}` : ""}`;
      const summary = `${sido} ${sigungu} ${dong} ${jibun}`;
      const nextRows = createYearRows({
        location: `${sido} ${sigungu} ${dong}`,
        jibun,
      });
      setRows(nextRows);
      setMessage(`검색 완료: ${summary}`);
      if (isLoggedIn) {
        addSearchHistory({
          ownerKey: user?.user_id ?? user?.email ?? "unknown",
          type: "지번",
          summary,
          results: nextRows,
        });
      }
      return;
    }

    if (!roadName || !buildingMainNo) {
      setMessage("도로명 검색에는 도로명과 건물번호가 필요합니다.");
      return;
    }
    const roadAddress = `${roadName} ${buildingMainNo}${buildingSubNo ? `-${buildingSubNo}` : ""}`;
    const summary = `${sido} ${sigungu} ${roadAddress}`;
    const nextRows = createYearRows({
      location: `${sido} ${sigungu} ${roadAddress}`,
      jibun: "변환지번 12-1",
    });
    setRows(nextRows);
    setMessage(`검색 완료: ${summary}`);
    if (isLoggedIn) {
      addSearchHistory({
        ownerKey: user?.user_id ?? user?.email ?? "unknown",
        type: "도로명",
        summary,
        results: nextRows,
      });
    }
  };

  return (
    <>
      {!isLoggedIn ? (
        <section className="hero-lite">
          <h1>정확한 토지 가치 데이터, 더 쉽게</h1>
          <p>비로그인 상태에서도 개별 주소 조회를 바로 사용할 수 있습니다.</p>
        </section>
      ) : null}

      <section className="panel">
        <h2>주소 선택</h2>
        <div className="tab-row">
          <button className={`tab-chip ${searchTab === "지번" ? "on" : ""}`} onClick={() => setSearchTab("지번")}>
            지번 검색
          </button>
          <button className={`tab-chip ${searchTab === "도로명" ? "on" : ""}`} onClick={() => setSearchTab("도로명")}>
            도로명 검색
          </button>
        </div>

        <div className="selector-grid">
          <SelectBox title="시/도 선택" value={sido} items={sidoList} onChange={onSelectSido} />
          <SelectBox title="시/군/구 선택" value={sigungu} items={sigunguList} onChange={onSelectSigungu} />

          {searchTab === "지번" ? (
            <SelectBox title="읍/면/동 선택" value={dong} items={dongList} onChange={setDong} />
          ) : (
            <div>
              <label className="field-label">도로명 선택</label>
              <div className="road-select-combo">
                <select
                  className="scroll-select initials"
                  size={8}
                  value={roadInitial}
                  onChange={(e) => {
                    setRoadInitial(e.target.value as "" | (typeof ROAD_INITIALS)[number]);
                    setRoadName("");
                  }}
                >
                  <option value="">선택</option>
                  {ROAD_INITIALS.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
                <select className="scroll-select roads" size={8} value={roadName} onChange={(e) => setRoadName(e.target.value)}>
                  {roadList.map((road) => (
                    <option key={road} value={road}>
                      {road}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {searchTab === "지번" ? (
          <div className="inline-form">
            <span className="inline-label">지번 입력</span>
            <select className="mini-select" value={sanType} onChange={(e) => setSanType(e.target.value as (typeof SAN_OPTIONS)[number])}>
              {SAN_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input className="mini-input" value={mainNo} onChange={(e) => setMainNo(e.target.value)} placeholder="본번" />
            <span>-</span>
            <input className="mini-input" value={subNo} onChange={(e) => setSubNo(e.target.value)} placeholder="부번" />
          </div>
        ) : (
          <div className="inline-form">
            <span className="inline-label">건물번호</span>
            <input className="mini-input" value={buildingMainNo} onChange={(e) => setBuildingMainNo(e.target.value)} placeholder="본번" />
            <span>-</span>
            <input className="mini-input" value={buildingSubNo} onChange={(e) => setBuildingSubNo(e.target.value)} placeholder="부번" />
          </div>
        )}

        <button className="btn-primary full" onClick={runSearch}>
          검색
        </button>
        <p className="hint">{message}</p>
      </section>

      <section className="panel">
        <h2>검색 결과</h2>
        {rows.length === 0 ? (
          <p className="hint">검색 결과가 없습니다.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>가격기준년도</th>
                <th>토지소재지</th>
                <th>지번</th>
                <th>개별공시지가</th>
                <th>기준일자</th>
                <th>공시일자</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`${row.토지소재지}-${idx}`}>
                  <td>{row.기준년도}</td>
                  <td>{row.토지소재지}</td>
                  <td>{row.지번}</td>
                  <td>{row.개별공시지가}</td>
                  <td>{row.기준일자}</td>
                  <td>{row.공시일자}</td>
                  <td>{row.비고}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {!isLoggedIn ? (
        <section className="panel promo-min">
          <h2>파일 조회 (로그인 필요)</h2>
          <p>회원가입 후 최대 10,000행 엑셀 업로드, 비동기 처리, 결과 다운로드를 사용할 수 있습니다.</p>
        </section>
      ) : null}
    </>
  );
}

function SelectBox(props: {
  title: string;
  value: string;
  items: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="field-label">{props.title}</label>
      <select className="scroll-select" size={8} value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        {props.items.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}

function createYearRows(params: { location: string; jibun: string }): LandResultRow[] {
  const rows: LandResultRow[] = [];
  for (let year = 2025; year >= 1990; year -= 1) {
    const price = (1_000_000 + (2025 - year) * 11000).toLocaleString("ko-KR");
    rows.push({
      기준년도: String(year),
      토지소재지: params.location,
      지번: params.jibun,
      개별공시지가: `${price} 원/㎡`,
      기준일자: "01월 01일",
      공시일자: `${year}0430`,
      비고: "정상",
    });
  }
  return rows;
}
