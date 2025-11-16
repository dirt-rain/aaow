# Storage Requirements

## 개요

`aaow`의 스토리지 어댑터는 워크플로우 실행, 세션 관리, 예산 추적, LLM 실행 로그 등 런타임 데이터를 영구 저장하기 위한 인터페이스를 정의합니다.

## 저장해야 할 데이터

### 1. Workflow 정의

워크플로우의 구조적 정의를 저장합니다.

- **Workflow**: 전체 워크플로우 정의 (노드 그래프, 엣지, 타입 정의)
- **WorkflowNode**: 개별 노드 정의 (LLM, Transform, Stream, Generator 등)
- **WorkflowEdge**: 노드 간 연결 관계
- **WorkflowContext**: 워크플로우 컨텍스트 데이터

**목적**:
- 워크플로우 재사용 및 버전 관리
- 실행 시 워크플로우 로드
- CallWorkflow 노드에서 외부 워크플로우 참조

### 2. Session 정보

워크플로우 실행 세션을 추적합니다.

- **Session ID**: 고유 세션 식별자
- **Workflow ID**: 실행 중인 워크플로우 참조
- **Status**: 실행 상태 (running, paused, completed, failed)
- **Created At / Updated At**: 생성 및 수정 시간
- **Metadata**: 추가 메타데이터 (사용자 정보, 태그 등)

**목적**:
- 여러 워크플로우 실행 추적
- 세션별 격리 및 관리
- 중단된 워크플로우 재개

### 3. Execution Context 및 상태

개별 워크플로우 실행의 런타임 컨텍스트를 저장합니다.

- **Session ID**: 세션 참조
- **Budget Pool ID**: 예산 풀 참조
- **Started At**: 시작 시간
- **Completed At**: 완료 시간
- **Current Node ID**: 현재 실행 중인 노드
- **Node Execution States**: 각 노드의 실행 상태 및 결과
- **Metadata**: 실행 관련 메타데이터

**목적**:
- 워크플로우 실행 재개
- 실행 진행 상황 모니터링
- 디버깅 및 추적

### 4. LLM Execution Results

LLM 노드 실행 결과와 로그를 저장합니다.

- **Execution ID**: 실행 식별자
- **Node ID**: LLM 노드 참조
- **Session ID**: 세션 참조
- **Success**: 성공 여부
- **Text Output**: 생성된 텍스트
- **Tool Calls**: 도구 호출 목록 및 결과
- **Token Usage**: 토큰 사용량 (prompt, completion, total)
- **Error**: 오류 메시지 (실패 시)
- **Timestamp**: 실행 시간
- **Metadata**: 추가 메타데이터

**목적**:
- LLM 호출 로그 및 감사
- 비용 추적 및 분석
- 디버깅 및 성능 최적화
- 재시도 로직 지원

### 5. Budget Pool 정보

계층적 예산 풀을 추적합니다.

- **Pool ID**: 예산 풀 식별자
- **Parent Pool ID**: 부모 풀 참조 (계층 구조)
- **Total Budget**: 총 할당 예산 (토큰 또는 비용)
- **Used Budget**: 사용된 예산
- **Remaining Budget**: 남은 예산
- **Status**: 상태 (active, exhausted, suspended)
- **Created At**: 생성 시간
- **Metadata**: 추가 정보

**목적**:
- 비용 제어 및 추적
- 계층적 예산 관리
- 예산 초과 방지
- 예산 승인 워크플로우 (human-in-the-loop)

### 6. Tool Call Logs

도구 호출 세부 정보를 저장합니다.

- **Tool Call ID**: 도구 호출 식별자
- **Execution ID**: LLM 실행 참조
- **Tool Name**: 호출된 도구 이름
- **Arguments**: 전달된 인수
- **Result**: 실행 결과
- **Error**: 오류 (실패 시)
- **Timestamp**: 호출 시간
- **Duration**: 실행 시간

**목적**:
- 도구 사용 추적
- 디버깅
- 성능 분석
- 감사 로그

### 7. Stream Events (선택적)

Stream 노드의 이벤트 로그를 저장합니다.

- **Stream ID**: 스트림 식별자
- **Node ID**: Stream 노드 참조
- **Event Data**: 스트림 이벤트 데이터
- **Timestamp**: 이벤트 시간

**목적**:
- 반응형 데이터 처리 추적
- 디버깅
- 이벤트 재생

## 스토리지 어댑터 요구사항

### SQLite 기반 구현 (초기 목표)

SQLite는 다음과 같은 이점을 제공합니다:

- **간단한 설정**: 별도의 서버 불필요
- **로컬 개발**: 빠른 로컬 개발 및 테스트
- **트랜잭션 지원**: ACID 트랜잭션 보장
- **성능**: 단일 사용자/서버 시나리오에 충분한 성능

### 어댑터 인터페이스 요구사항

1. **CRUD 작업**: Create, Read, Update, Delete 지원
2. **트랜잭션**: 원자적 작업 보장
3. **쿼리**: 필터링 및 정렬 지원
4. **관계**: 외래 키 및 조인 지원
5. **마이그레이션**: 스키마 버전 관리
6. **비동기**: 비동기 I/O 지원

### 확장성 고려사항

향후 다른 스토리지 백엔드로 확장 가능하도록 설계:

- PostgreSQL (프로덕션 환경)
- MongoDB (문서 지향 저장)
- Redis (캐싱 레이어)
- S3/Object Storage (대용량 데이터)

## 스키마 설계 고려사항

### 정규화

- 중복 최소화
- 참조 무결성 유지
- 쿼리 성능 최적화

### 인덱싱

주요 쿼리 경로에 인덱스 추가:
- Session ID로 실행 조회
- Workflow ID로 정의 조회
- Timestamp 범위 쿼리

### JSON 필드

유연한 메타데이터는 JSON 컬럼 사용:
- ExecutionContext.metadata
- LLMExecutionResult.metadata
- BudgetPool.metadata

## 데이터 보존 정책

- **개발**: 무제한 보존
- **프로덕션**: 설정 가능한 보존 기간
- **자동 정리**: 오래된 로그 아카이빙/삭제

## 보안 고려사항

- **민감 데이터**: API 키, 사용자 정보 암호화
- **접근 제어**: 세션 격리
- **감사 로그**: 모든 변경 사항 추적
