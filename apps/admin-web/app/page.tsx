"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type MemberCandidate = {
  memberId: string;
  name: string;
  department: string;
  employeeNoLast4: string;
  role: "MEMBER" | "ADMIN";
};

type AdminFoodStatus = "ALL" | "REGISTERED" | "TAKEN_OUT" | "DISPOSED" | "EXPIRED";

type AdminFoodItem = {
  id: string;
  foodName: string;
  expiryDate: string;
  registeredAt: string;
  status: Exclude<AdminFoodStatus, "ALL">;
  isOverdue: boolean;
  owner: {
    name: string;
    department: string;
    employeeNoLast4: string;
    email: string;
  };
};

type AdminFoodsResponse = {
  summary: {
    total: number;
    registered: number;
    takenOut: number;
    disposed: number;
    expired: number;
    overdue: number;
  };
  limit: number;
  items: AdminFoodItem[];
};

const STATUS_OPTIONS: Array<{
  value: AdminFoodStatus;
  label: string;
  description: string;
}> = [
  { value: "ALL", label: "전체", description: "전체 등록 이력" },
  { value: "REGISTERED", label: "보관중", description: "현재 냉장고에 있는 음식" },
  { value: "TAKEN_OUT", label: "가져감", description: "구성원이 가져간 음식" },
  { value: "DISPOSED", label: "폐기", description: "관리자가 폐기한 음식" },
  { value: "EXPIRED", label: "만료 상태", description: "기존 EXPIRED 상태 데이터" }
];

const EMPTY_SUMMARY: AdminFoodsResponse["summary"] = {
  total: 0,
  registered: 0,
  takenOut: 0,
  disposed: 0,
  expired: 0,
  overdue: 0
};

function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  return "http://localhost:4000";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric"
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getStatusLabel(status: AdminFoodItem["status"], isOverdue: boolean) {
  if (status === "REGISTERED" && isOverdue) {
    return "보관중 · 기한 경과";
  }

  switch (status) {
    case "REGISTERED":
      return "보관중";
    case "TAKEN_OUT":
      return "가져감";
    case "DISPOSED":
      return "폐기";
    case "EXPIRED":
      return "만료 상태";
    default:
      return status;
  }
}

function getStatusTone(status: AdminFoodItem["status"], isOverdue: boolean) {
  if (status === "REGISTERED" && isOverdue) {
    return styles.statusWarning;
  }

  switch (status) {
    case "REGISTERED":
      return styles.statusRegistered;
    case "TAKEN_OUT":
      return styles.statusTakenOut;
    case "DISPOSED":
      return styles.statusDisposed;
    case "EXPIRED":
      return styles.statusExpired;
    default:
      return styles.statusRegistered;
  }
}

export default function AdminHomePage() {
  const [apiBase, setApiBase] = useState("http://localhost:4000");
  const [adminQuery, setAdminQuery] = useState("");
  const [adminCandidates, setAdminCandidates] = useState<MemberCandidate[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<MemberCandidate | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminFoodStatus>("ALL");
  const [items, setItems] = useState<AdminFoodItem[]>([]);
  const [summary, setSummary] = useState<AdminFoodsResponse["summary"]>(EMPTY_SUMMARY);
  const [limit, setLimit] = useState(100);
  const [message, setMessage] = useState("관리자를 선택하면 전체 등록 목록을 불러옵니다.");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    setApiBase(getApiBase());
  }, []);

  const selectedStatusMeta = useMemo(
    () => STATUS_OPTIONS.find((option) => option.value === statusFilter) ?? STATUS_OPTIONS[0],
    [statusFilter]
  );

  async function lookupAdmins() {
    if (!adminQuery.trim()) {
      setMessage("관리자 이름을 입력해 주세요.");
      return;
    }

    const response = await fetch(`${apiBase}/v1/auth/name-lookup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nameQuery: adminQuery.trim() })
    });

    if (!response.ok) {
      setMessage(await response.text());
      return;
    }

    const data = (await response.json()) as { candidates: MemberCandidate[] };
    const admins = data.candidates.filter((candidate) => candidate.role === "ADMIN");
    setAdminCandidates(admins);
    setMessage(admins.length > 0 ? "운영 관리자를 선택해 주세요." : "관리자 후보를 찾지 못했습니다.");
  }

  async function loadFoods(nextSearch = searchQuery, nextStatus = statusFilter) {
    if (!selectedAdmin) {
      setMessage("관리자를 먼저 선택해 주세요.");
      return;
    }

    setIsBusy(true);

    try {
      const params = new URLSearchParams({
        limit: "150",
        status: nextStatus
      });

      if (nextSearch.trim()) {
        params.set("q", nextSearch.trim());
      }

      const response = await fetch(`${apiBase}/v1/admin/foods?${params.toString()}`, {
        headers: { "x-member-id": selectedAdmin.memberId }
      });

      if (!response.ok) {
        setMessage(await response.text());
        return;
      }

      const data = (await response.json()) as AdminFoodsResponse;
      setItems(data.items);
      setSummary(data.summary);
      setLimit(data.limit);

      if (data.items.length === 0) {
        setMessage("현재 조건에 맞는 등록 목록이 없습니다.");
      } else {
        setMessage(`${data.items.length}건을 표시 중입니다. 상태별 집계는 전체 결과 기준입니다.`);
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function resolveFood(foodItemId: string, status: "TAKEN_OUT" | "DISPOSED") {
    if (!selectedAdmin) {
      return;
    }

    setIsBusy(true);

    try {
      const response = await fetch(`${apiBase}/v1/foods/${foodItemId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-member-id": selectedAdmin.memberId
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        setMessage(await response.text());
        return;
      }

      await loadFoods();
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    if (!selectedAdmin) {
      return;
    }

    void loadFoods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAdmin, statusFilter]);

  const statCards = [
    { label: "전체 등록", value: summary.total, tone: styles.statPaper },
    { label: "보관중", value: summary.registered, tone: styles.statMint },
    { label: "가져감", value: summary.takenOut, tone: styles.statSky },
    { label: "폐기", value: summary.disposed, tone: styles.statRose },
    { label: "기한 경과", value: summary.overdue, tone: styles.statAmber }
  ];

  return (
    <main className={styles.page}>
      <div className={styles.bgGlowTop} />
      <div className={styles.bgGlowBottom} />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>Fridge Ledger</span>
          <h1>전체 등록 목록을 한 화면에서 운영하는 관리자 페이지</h1>
          <p>
            태블릿은 구성원이 쓰고, 관리자는 여기에서 전체 이력과 현재 보관 상태를 보고 바로 가져감 또는 폐기
            처리합니다.
          </p>
        </div>
        <div className={styles.heroMeta}>
          <div className={styles.metaLabel}>현재 보기</div>
          <strong>{selectedStatusMeta.label}</strong>
          <span>{selectedStatusMeta.description}</span>
          <div className={styles.metaFoot}>목록 제한 {limit}건</div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionEyebrow}>Operator</span>
            <h2>관리자 선택</h2>
          </div>
          {selectedAdmin ? (
            <div className={styles.selectedAdmin}>
              <strong>{selectedAdmin.name}</strong>
              <span>
                {selectedAdmin.department} / 사번 끝 {selectedAdmin.employeeNoLast4}
              </span>
            </div>
          ) : null}
        </div>

        <div className={styles.lookupRow}>
          <input
            className={styles.input}
            value={adminQuery}
            onChange={(event) => setAdminQuery(event.target.value)}
            placeholder="관리자 이름"
          />
          <button type="button" className={styles.primaryButton} onClick={() => void lookupAdmins()}>
            관리자 조회
          </button>
        </div>

        {adminCandidates.length > 0 ? (
          <div className={styles.candidateGrid}>
            {adminCandidates.map((candidate) => (
              <button
                key={candidate.memberId}
                type="button"
                className={`${styles.candidateCard} ${
                  selectedAdmin?.memberId === candidate.memberId ? styles.candidateActive : ""
                }`}
                onClick={() => setSelectedAdmin(candidate)}
              >
                <strong>{candidate.name}</strong>
                <span>{candidate.department}</span>
                <span>사번 끝 {candidate.employeeNoLast4}</span>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className={styles.statsGrid}>
        {statCards.map((card) => (
          <article key={card.label} className={`${styles.statCard} ${card.tone}`}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionEyebrow}>Registry</span>
            <h2>전체 등록 목록</h2>
          </div>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void loadFoods()}
            disabled={!selectedAdmin || isBusy}
          >
            {isBusy ? "불러오는 중" : "새로고침"}
          </button>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <input
              className={styles.input}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="음식 이름, 구성원, 이메일, 사번으로 검색"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void loadFoods();
                }
              }}
            />
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void loadFoods()}
              disabled={!selectedAdmin || isBusy}
            >
              검색
            </button>
          </div>

          <div className={styles.filterRail}>
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.filterChip} ${statusFilter === option.value ? styles.filterChipActive : ""}`}
                onClick={() => setStatusFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.messageBar}>{message}</div>

        {!selectedAdmin ? (
          <div className={styles.emptyState}>
            <strong>관리자를 먼저 선택해 주세요.</strong>
            <span>선택이 끝나면 전체 등록 목록을 바로 불러옵니다.</span>
          </div>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>현재 조건에 맞는 항목이 없습니다.</strong>
            <span>검색어를 지우거나 상태 필터를 바꿔 보세요.</span>
          </div>
        ) : (
          <div className={styles.list}>
            {items.map((item) => (
              <article key={item.id} className={styles.rowCard}>
                <div className={styles.rowMain}>
                  <div className={styles.rowTop}>
                    <div>
                      <h3>{item.foodName}</h3>
                      <p>
                        {item.owner.name} · {item.owner.department} · 사번 끝 {item.owner.employeeNoLast4}
                      </p>
                    </div>
                    <span className={`${styles.statusBadge} ${getStatusTone(item.status, item.isOverdue)}`}>
                      {getStatusLabel(item.status, item.isOverdue)}
                    </span>
                  </div>

                  <div className={styles.metaGrid}>
                    <div>
                      <span>이메일</span>
                      <strong>{item.owner.email}</strong>
                    </div>
                    <div>
                      <span>등록 시각</span>
                      <strong>{formatDateTime(item.registeredAt)}</strong>
                    </div>
                    <div>
                      <span>유통기한</span>
                      <strong>{formatDate(item.expiryDate)}</strong>
                    </div>
                    <div>
                      <span>아이템 ID</span>
                      <strong>{item.id.slice(0, 8)}</strong>
                    </div>
                  </div>
                </div>

                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.actionButton}
                    disabled={item.status !== "REGISTERED" || isBusy}
                    onClick={() => void resolveFood(item.id, "TAKEN_OUT")}
                  >
                    가져감 처리
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.dangerButton}`}
                    disabled={item.status !== "REGISTERED" || isBusy}
                    onClick={() => void resolveFood(item.id, "DISPOSED")}
                  >
                    폐기 처리
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
